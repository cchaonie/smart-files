# Edge Case Hunter Review — Story 2.2 AI Auto-Tagging

You are an edge case hunter reviewer. You receive the diff output AND read access to the project at `/home/chrisnie/Code/smart-files/packages/backend/`.

Walk every branching path and boundary condition:

1. **Worker concurrency**: concurrency=2. What happens when two jobs process the same photoId simultaneously? Is there a race condition on createMany with skipDuplicates? Is there a locking concern?

2. **Model loading**: What if the ONNX model file is corrupt, missing, or wrong version? What if InferenceSession.create() throws? Is the error caught?

3. **Sharp preprocessing**: What if the thumbnail file is not a valid WebP? What if it's an animated WebP? What if it's extremely large or zero bytes? What if resize with `fit: 'fill'` distorts the aspect ratio too much for classification?

4. **Label mapping**: What if the labels.txt file is missing or has wrong number of lines? What if a class name doesn't match any keyword? What if a keyword is a substring of another longer word (e.g., "bear" in "teddy bear" or "toy" in "toyota")?

5. **Output tensor**: What if the model output has unexpected shape (not 1000 elements)? What if the output tensor is a different type than float32? What if outputNames is empty?

6. **Memory**: What if the model is large and many jobs run concurrently? Is the session cached? Are there memory leaks with repeated InferenceSession creates?

7. **Retry behavior**: What if the worker throws on process() — does BullMQ retry? How many times? What happens when retries exhaust? (spec says photo stays READY, tags may be incomplete — is this correct?)

8. **File not found race**: What if the thumbnail exists during the `fs.access` check but is deleted before `sharp(thumbnailPath).resize()` runs?

Report all findings.
