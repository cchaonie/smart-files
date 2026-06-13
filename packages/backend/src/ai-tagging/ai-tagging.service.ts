import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { matchTag, imageNetLabels, initLabels } from './label-map';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ort = require('onnxruntime-node');

@Injectable()
export class AiTaggingService {
  private readonly logger = new Logger(AiTaggingService.name);
  private session: any = null;
  private readonly modelPath: string;
  private readonly labelsPath: string;

  // ImageNet normalization constants
  private readonly mean = [0.485, 0.456, 0.406];
  private readonly std = [0.229, 0.224, 0.225];

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const modelsDir = path.resolve(__dirname, '../../models');
    this.modelPath = path.join(modelsDir, 'mobilenet_v3_small.onnx');
    this.labelsPath = path.join(modelsDir, 'labels.txt');
  }

  /**
   * Lazy-load the ONNX session on first call.
   */
  private async getSession(): Promise<any> {
    if (!this.session) {
      this.logger.log(`Loading ONNX model from ${this.modelPath}`);
      this.session = await ort.InferenceSession.create(this.modelPath);
      this.logger.log('ONNX model loaded successfully');
    }
    return this.session;
  }

  /**
   * Lazy-load ImageNet labels on first call.
   */
  private async ensureLabels(): Promise<void> {
    if (imageNetLabels.length === 0) {
      const content = await fs.readFile(this.labelsPath, 'utf-8');
      const labels = content.trim().split('\n');
      initLabels(labels);
      this.logger.log(`Loaded ${labels.length} ImageNet labels`);
    }
  }

  /**
   * Normalize raw pixel values to float32 tensor following ImageNet stats.
   * Returns a Float32Array in NCHW layout: [1, 3, 224, 224].
   */
  private normalizeImage(rawPixels: Buffer): Float32Array {
    const numPixels = 224 * 224;
    const tensor = new Float32Array(3 * numPixels);

    for (let i = 0; i < numPixels; i++) {
      const r = rawPixels[i * 3] / 255.0;
      const g = rawPixels[i * 3 + 1] / 255.0;
      const b = rawPixels[i * 3 + 2] / 255.0;

      // NCHW: channel 0=R, 1=G, 2=B
      tensor[i] = (r - this.mean[0]) / this.std[0];                       // R channel
      tensor[numPixels + i] = (g - this.mean[1]) / this.std[1];           // G channel
      tensor[2 * numPixels + i] = (b - this.mean[2]) / this.std[2];       // B channel
    }

    return tensor;
  }

  /**
   * Softmax over a Float32Array of logits, returns probability array.
   */
  private softmax(logits: Float32Array): number[] {
    const max = Math.max(...Array.from(logits));
    const exps = Array.from(logits).map(v => Math.exp(v - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map(v => v / sum);
  }

  /**
   * Classify a thumbnail image.
   *
   * @param thumbnailPath - Absolute path to the 320px WebP thumbnail
   * @returns Array of { tag, confidence } sorted by confidence descending,
   *          limited to top-5 above the 0.3 threshold. Empty array when
   *          no predictions pass the threshold.
   */
  async classify(
    thumbnailPath: string,
  ): Promise<{ tag: string; confidence: number }[]> {
    // 1. Load model + labels if not yet loaded
    const session = await this.getSession();
    await this.ensureLabels();

    // 2. Decode thumbnail to 224x224 raw RGB pixels using Sharp
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sharp = require('sharp');
    const rawPixels = await sharp(thumbnailPath)
      .resize(224, 224, { fit: 'fill' })
      .raw()
      .toBuffer();

    // 3. Normalize to float32 tensor in NCHW layout
    const inputTensor = new ort.Tensor('float32', this.normalizeImage(rawPixels), [1, 3, 224, 224]);

    // 4. Run inference — try common input names
    const inputs = session.inputNames;
    const inputName = inputs.find((n: string) =>
      ['input', 'data', 'input.1', 'images', 'x'].includes(n),
    ) || inputs[0];

    if (!inputName) {
      this.logger.warn('No input found in ONNX model');
      return [];
    }

    const outputs = await session.run({ [inputName]: inputTensor });

    // Extract logits from the output tensor
    const outputNames = session.outputNames;
    const outputName = outputNames[0];
    if (!outputName || !outputs[outputName]) {
      this.logger.warn('No output tensor found in ONNX model results');
      return [];
    }
    const logits = outputs[outputName].data as Float32Array;

    // 5. Softmax to get probabilities
    const probabilities = this.softmax(logits);

    // 6. Find top-5 above threshold
    const threshold = 0.3;
    const results: { tag: string; confidence: number }[] = [];

    // Get indices sorted by confidence descending
    const indices = probabilities
      .map((p, i) => ({ index: i, prob: p }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 5)
      .filter(item => item.prob >= threshold);

    for (const { index, prob } of indices) {
      const tag = matchTag(index);
      if (tag) {
        results.push({ tag, confidence: Math.round(prob * 100) / 100 });
      }
    }

    return results;
  }

  /**
   * Save tags to PhotoTag table using createMany with skipDuplicates.
   */
  async saveTags(
    photoId: string,
    tags: { tag: string; confidence: number }[],
  ): Promise<void> {
    if (tags.length === 0) return;

    await this.prisma.photoTag.createMany({
      data: tags.map(t => ({
        photoId,
        tag: t.tag,
        confidence: t.confidence,
      })),
      skipDuplicates: true,
    });

    this.logger.log(`Saved ${tags.length} tags for photo ${photoId}`);
  }
}
