import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiTaggingService } from './ai-tagging.service';
import { PrismaService } from '../prisma/prisma.service';
import { initLabels } from './label-map';

describe('AiTaggingService', () => {
  let service: AiTaggingService;
  let mockPrisma: any;

  beforeAll(() => {
    // Initialize with minimal labels for testing
    initLabels([
      'tench',           // 0
      'goldfish',        // 1
      'great white shark', // 2
      'tiger shark',     // 3
      'hammerhead',      // 4
      'electric ray',    // 5
      'stingray',        // 6
      'cock',            // 7
      'hen',             // 8
      'ostrich',         // 9
      'bald eagle',      // 10
      'bulbul',          // 11
      'robin',           // 12
      'jay',             // 13
      'magpie',          // 14
      'duck',            // 15
      'golden retriever', // 16
      'dalmatian',       // 17
      'pizza',           // 18
      'sunset',          // 19
      'notebook',        // 20
      'infant',          // 21
      'toaster',         // 22 — no match
    ]);
  });

  beforeEach(async () => {
    mockPrisma = {
      photoTag: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiTaggingService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('/mnt/pool') } },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AiTaggingService>(AiTaggingService);
    // Override session to prevent actual model load
    (service as any).session = { run: jest.fn() };
    (service as any).modelPath = '/fake/model.onnx';
  });

  describe('saveTags', () => {
    it('should call createMany with tags', async () => {
      const tags = [{ tag: '宠物', confidence: 0.85 }];
      await service.saveTags('photo-1', tags);

      expect(mockPrisma.photoTag.createMany).toHaveBeenCalledWith({
        data: [{ photoId: 'photo-1', tag: '宠物', confidence: 0.85 }],
        skipDuplicates: true,
      });
    });

    it('should skip save when tags array is empty', async () => {
      await service.saveTags('photo-1', []);
      expect(mockPrisma.photoTag.createMany).not.toHaveBeenCalled();
    });
  });

  describe('normalizeImage', () => {
    it('should produce a Float32Array of correct length', () => {
      const rawPixels = Buffer.alloc(224 * 224 * 3, 128); // mid-gray
      const result = (service as any).normalizeImage(rawPixels);
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(3 * 224 * 224);
    });
  });

  describe('softmax', () => {
    it('should return probabilities that sum to 1', () => {
      const logits = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0]);
      const probs = (service as any).softmax(logits);
      const sum = probs.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe('matchTag', () => {
    it('should match "宠物" for goldfish (index 1)', () => {
      const { matchTag } = require('./label-map');
      expect(matchTag(1)).toBe('宠物');
    });

    it('should match "美食" for pizza (index 18)', () => {
      const { matchTag } = require('./label-map');
      expect(matchTag(18)).toBe('美食');
    });

    it('should match "日落" for sunset (index 19)', () => {
      const { matchTag } = require('./label-map');
      expect(matchTag(19)).toBe('日落');
    });

    it('should match "宝宝" for infant (index 21)', () => {
      const { matchTag } = require('./label-map');
      expect(matchTag(21)).toBe('宝宝');
    });

    it('should return null for non-matching label (index 22 toaster)', () => {
      const { matchTag } = require('./label-map');
      expect(matchTag(22)).toBeNull();
    });

    it('should return null for out-of-range index', () => {
      const { matchTag } = require('./label-map');
      expect(matchTag(9999)).toBeNull();
    });
  });
});
