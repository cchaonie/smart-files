/**
 * ImageNet class keyword → Chinese tag mapping for the AI tagging pipeline.
 *
 * Each entry maps a set of English keywords (lowercase) found in ImageNet
 * class labels to a Chinese display tag. A class matches if ANY keyword
 * in the list appears in its label string.
 */
export const TAG_KEYWORDS: Record<string, string[]> = {
  '宝宝': ['baby', 'infant', 'crib', 'cradle'],
  '户外': ['valley', 'volcano', 'cliff', 'seashore', 'beach', 'coast',
    'lakeside', 'park', 'lawn', 'meadow', 'field', 'pasture', 'hayfield',
    'woodland', 'forest', 'jungle', 'desert', 'alpine', 'tundra',
    'garden', 'terrace'],
  '美食': ['pizza', 'spaghetti', 'plate', 'soup', 'stew', 'potpie',
    'burrito', 'hotdog', 'hamburger', 'sandwich', 'bagel', 'croissant',
    'pretzel', 'dough', 'cake', 'cupcake', 'cookie', 'chocolate', 'candy',
    'lollipop', 'ice cream', 'donut', 'pie', 'fruit', 'salad', 'sushi',
    'menu', 'cheese', 'bread', 'roast', 'beverage', 'coffee', 'cocktail',
    'wine', 'beer', 'bottle', 'goblet', 'egg', 'mushroom', 'vegetable',
    'corn', 'pudding', 'custard', 'biscuit', 'muffin', 'waffle', 'pancake',
    'cannelloni', 'lasagna', 'carbonara', 'paella', 'falafel', 'kabob',
    'taco', 'enchilada', 'burrito', 'chili', 'steak', 'chop', 'sauce'],
  '合影': ['crowd', 'audience', 'family', 'group', 'people'],
  '文件': ['envelope', 'notebook', 'paper', 'document', 'bookshelf',
    'bookshop', 'library'],
  '日落': ['sunset', 'sunrise', 'dusk', 'dawn', 'horizon'],
  '宠物': ['dog', 'cat', 'puppy', 'kitten', 'rabbit', 'hamster',
    'guinea pig', 'parrot', 'turtle', 'lizard', 'snake', 'gerbil',
    'ferret', 'chinchilla', 'canary', 'finch', 'goldfinch', 'brambling',
    'magpie', 'jay', 'robin', 'bulbul', 'hen', 'cock', 'ostrich',
    'peacock', 'quail', 'partridge', 'pheasant', 'duck', 'goose',
    'swan', 'penguin', 'owl', 'hawk', 'eagle', 'vulture', 'goldfish',
    'koi', 'stingray', 'eel', 'seahorse', 'jellyfish', 'starfish',
    'conch', 'snail', 'slug', 'crab', 'lobster', 'shrimp', 'frog',
    'toad', 'axolotl', 'tortoise', 'gecko', 'iguana', 'chameleon',
    'alligator', 'crocodile', 'monkey', 'marmoset', 'lemur', 'gorilla',
    'orangutan', 'chimpanzee', 'gibbon', 'squirrel', 'beaver', 'otter',
    'hedgehog', 'porcupine', 'raccoon', 'skunk', 'badger', 'weasel',
    'mink', 'polecat', 'marten', 'coyote', 'dhole', 'dingo', 'hyena',
    'aardvark', 'anteater', 'platypus', 'echidna', 'koala', 'wombat',
    'wallaby', 'kangaroo', 'bandicoot', 'opossum', 'sloth',
    'antelope', 'gazelle', 'deer', 'moose', 'elk', 'caribou',
    'bison', 'buffalo', 'yak', 'ox', 'cow', 'calf', 'pig', 'boar',
    'sheep', 'goat', 'lamb', 'horse', 'pony', 'zebra', 'donkey',
    'mule', 'camel', 'llama', 'alpaca', 'elephant', 'rhinoceros',
    'hippopotamus', 'tiger', 'lion', 'leopard', 'cheetah', 'jaguar',
    'panther', 'wolf', 'fox', 'bear', 'panda', 'raccoon', 'mouse',
    'rat', 'vole', 'chipmunk', 'gopher', 'mole', 'shrew', 'bat',
    'whale', 'dolphin', 'porpoise', 'seal', 'walrus', 'sea lion',
    'otter', 'manatee', 'dugong'],
  '玩具': ['toy', 'doll', 'lego', 'kite', 'puzzle', 'teddy', 'bear',
    'ball', 'yo-yo', 'maraca', 'harmonica', 'whistle', 'drum',
    'trombone', 'trumpet', 'saxophone', 'flute', 'recorder',
    'balloon', 'pinwheel', 'top', 'dumbbell', 'barbell',
    'tricycle', 'scooter', 'skateboard', 'sled', 'cart'],
  '风景': ['waterfall', 'river', 'lake', 'ocean', 'sea', 'mountain',
    'hill', 'canyon', 'coral', 'geyser', 'rainbow', 'reef', 'glacier',
    'fjord', 'coastline', 'shore', 'cliff', 'cave', 'grotto', 'island',
    'peninsula', 'bay', 'gulf', 'lagoon', 'pond', 'stream', 'creek',
    'spring', 'water', 'landscape', 'panorama', 'scenery', 'nature',
    'bamboo', 'bonsai', 'terrarium'],
  '人像': ['person', 'man', 'woman', 'girl', 'boy', 'child',
    'portrait', 'face', 'selfie', 'bride', 'groom', 'model',
    'fashion', 'smile', 'laugh', 'expression', 'photograph'],
};

/**
 * ImageNet class labels (synset names) loaded at runtime from labels.txt.
 */
export let imageNetLabels: string[] = [];

/**
 * Initialize label cache from an array of 1000 class names.
 */
export function initLabels(labels: string[]): void {
  imageNetLabels = labels;
}

/**
 * Given an ImageNet class index [0-999], return the matching Chinese tag
 * or null if no keyword matches.
 */
export function matchTag(classIndex: number): string | null {
  if (classIndex < 0 || classIndex >= imageNetLabels.length) return null;
  const label = imageNetLabels[classIndex].toLowerCase();

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    for (const keyword of keywords) {
      // Match whole word in label (word boundary at start/end of keyword)
      if (label.includes(keyword)) {
        return tag;
      }
    }
  }

  return null;
}
