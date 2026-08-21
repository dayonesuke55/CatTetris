// piece.js — tetromino shapes, spawning, rotation, and the 7-bag queue.
//
// Each piece is plotted on a 4x4 local grid (coordinates 0-3). Rotation
// states are precomputed tables rather than derived via matrix rotation —
// simpler to read and to reason about for a first Tetris implementation.
// This is "SRS-lite": rotation just swaps to the next precomputed state
// and, on collision, tries a couple of simple horizontal kicks. It does
// not implement the full official SRS kick table, which is not needed
// for a casual, cat-flavored game.

import { CONFIG } from './config.js';

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Fur colors — one pastel hue per type, chosen to stay clearly
// distinguishable at a glance (same hue-separation as classic Tetris
// coloring: I=cyan, O=yellow, T=purple, S=green, Z=red, J=blue,
// L=orange) while matching the game's pastel/pink palette. renderer.js
// derives a lighter "belly patch" shade from each of these at draw
// time rather than storing a second color per type here.
export const COLORS = {
  I: '#7dd3f0',
  O: '#f5e37b',
  T: '#c99bf0',
  S: '#8fe0a0',
  Z: '#f0908f',
  J: '#7b8ff2',
  L: '#f0b06a',
};

// "Breed" per type — every single block is drawn as one cat face
// (see renderer.js), so this is what makes each of the 7 types read
// as a different cat rather than 7 copies of the same face in
// different colors. ear: 'pointed' | 'round' | 'tufted' | 'folded'.
// eye: 'round' | 'sleepy' | 'slant'. mark: 'none' | 'mask' | 'stripes'
// | 'patch'.
export const CAT_STYLES = {
  I: { ear: 'pointed', eye: 'slant', mark: 'mask' }, // siamese
  O: { ear: 'round', eye: 'sleepy', mark: 'none' }, // sleepy round face
  T: { ear: 'pointed', eye: 'round', mark: 'stripes' }, // classic tabby
  S: { ear: 'tufted', eye: 'round', mark: 'patch' }, // lynx-point, eye patch
  Z: { ear: 'folded', eye: 'slant', mark: 'patch' }, // scottish fold, eye patch
  J: { ear: 'pointed', eye: 'round', mark: 'mask' }, // dark-eared siamese-ish
  L: { ear: 'round', eye: 'round', mark: 'stripes' }, // orange tabby
};

// M7: how many lines cleared with a breed (affection.js's raw
// affection[type] count — the same counter M6's gauge already tracks,
// just read against a much longer schedule) unlock each of that
// breed's milestoneFacts, by index. Same schedule for every breed.
export const MILESTONE_COUNTS = [
  10, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
  550, 600, 650, 700, 750, 800, 850, 900, 950, 1000,
];

// M7: a bonus entry per breed, unlocked once the player's all-time
// high score (state.highScore, independent of any one breed's count)
// reaches this — a shared achievement shown on every breed's detail
// page once true.
export const SPECIAL_HIGH_SCORE = 10000;

// M6: the real-world breed each type's look is riffing on (see
// CAT_STYLES comments above), plus a one-line personality and cat-fact
// trivia — `trivia` is the short teaser shown on the M7 collection
// grid card, while `milestoneFacts` (one string per MILESTONE_COUNTS
// entry, same order) and `specialFact` are the deeper content unlocked
// on that breed's M7 detail page as its count climbs.
export const BREED_PROFILES = {
  I: {
    name: 'シャム',
    personality: 'おしゃべりで甘えん坊',
    trivia: '鳴き声がよく通り、気持ちを声でしっかり伝えてくれる猫種。',
    milestoneFacts: [
      'シャム猫はタイ王国原産で、かつては王族や寺院で大切に飼われていたと伝えられる。',
      '鳴き声が非常によく通ることで知られ、「おしゃべりな猫」の代表格。',
      '生まれたては全身が白く、成長するにつれて顔・耳・脚・尻尾に色がつく「ポイントカラー」が現れる。',
      '涼しい部位ほど毛色が濃く出るため、耳や鼻先、脚先、尻尾の色が特に濃い。',
      '鮮やかな青い瞳が特徴で、これは毛色を決める遺伝子と関係している。',
      'かつては「タイの王家にしか飼うことが許されない神聖な猫」という伝説があった。',
      '非常に人懐っこく、飼い主の後をついて歩く「犬のような猫」と称されることも。',
      '19世紀末にイギリスへ渡り、キャットショーで披露されて人気に火がついた。',
      '賢く好奇心旺盛で、ドアの開け方を覚えてしまう子もいるとか。',
      '涼しい地域で育つと、ポイントの色がより濃く出やすいと言われる。',
      'アメリカでは1950年代に大人気となり、多くの家庭に迎えられた。',
      'その声量の大きさから「エキゾチックな声を持つ猫」と呼ばれることもある。',
      '社交的な性格で、一匹だけの留守番が苦手な子も多いとされる。',
      '古くは「ロイヤルキャット・オブ・サイアム」という愛称で呼ばれていた。',
      '筋肉質でしなやかな体つきを持ち、ジャンプ力も高い。',
      '映画やアニメにもたびたび登場する、世界的に有名な猫種のひとつ。',
      '平均寿命は15年前後と、比較的長生きする傾向がある。',
      '感情表現が豊かで、機嫌が悪いとはっきり鳴いて伝えてくることも。',
      'タイでは古い呼び名「ワイシーサワート」で呼ばれていた記録が残る。',
      '飼い主と強い絆を築きやすく、依存心が強いとも言われる。',
      '現在も世界中の人気猫種ランキングでトップクラスに数えられる。',
    ],
    specialFact: '伝説のシャム猫は王家の宝石の番人だったという言い伝えも——あなたのスコアはまさに王家級。',
  },
  O: {
    name: 'ブリティッシュショートヘア',
    personality: 'マイペースで貫禄たっぷり',
    trivia: '丸いほっぺと落ち着いた性格で「クマみたいな猫」と称されることも。',
    milestoneFacts: [
      '起源は古代ローマ帝国の時代にイギリスへ持ち込まれた猫にあるとされる。',
      'がっしりした体格と丸い顔が特徴で、「テディベアのような猫」とよく称される。',
      '『不思議の国のアリス』のチェシャ猫のモデルとも言われている。',
      '被毛は密で厚く、まるでぬいぐるみのような手触り。',
      '性格はマイペースでおっとりしており、あまり鳴かない子が多い。',
      '運動量はそこまで多くなく、のんびり過ごすのを好む傾向がある。',
      '毛色はブルー(グレー)が特に有名だが、実は幅広いカラーバリエーションがある。',
      '独立心が強く、一人の時間もあまり苦にしない性格。',
      '英国原産の猫種の中でも、最も古い歴史を持つ品種のひとつ。',
      '丸い金色の瞳が、その愛らしさをより引き立てている。',
      '19世紀のキャットショーで最初に披露された品種のひとつとされる。',
      '世界大戦の影響で一時期は数が激減し、絶滅の危機に瀕したことがある。',
      '穏やかな性格から、初めて猫を飼う人にもおすすめされることが多い。',
      '短い被毛でも寒さに強いと言われている。',
      'がっしりした顎と広い頬が、独特な丸顔を作り出している。',
      'SNSでは「置物みたいにじっとしている」姿がよくシェアされる。',
      '成猫になるまで3〜5年ほどかけて、ゆっくり成長する。',
      '抱っこよりそばにいることを好む、控えめな甘え方をする子が多い。',
      'イギリスでは「ブリティッシュブルー」という呼び名が古くから親しまれてきた。',
      '落ち着いた性格から、多頭飼育にも向いていると言われる。',
      '今なお世界中のキャットショーで人気の常連となっている品種。',
    ],
    specialFact: 'どっしり構えたその姿はまさに"猫界の貴族"。1万点超えはあなたの貫禄の証。',
  },
  T: {
    name: 'キジトラ',
    personality: '人懐っこく物怖じしない',
    trivia: '日本で最もよく見かける柄のひとつ。野生のヤマネコに近い縞模様が特徴。',
    milestoneFacts: [
      '「キジトラ」は日本の国鳥キジの羽色に似ていることが名前の由来とされる。',
      'タビー柄は特定の猫種を指す言葉ではなく、野生のヤマネコに近い縞模様のパターンのこと。',
      '世界中で最も多く見られる毛色・柄のひとつと言われている。',
      '額にある「M字」模様は、タビー柄の猫に共通する特徴。',
      '縞模様には迷彩効果があり、狩りをする上で有利だったと考えられている。',
      '遺伝的には、ほぼすべての猫がタビー柄の遺伝子を持っているとされる。',
      '日本の民家で古くから親しまれてきた、いわば「ご近所の猫」的存在。',
      '性格は個体差が大きいが、人懐っこく物怖じしない子が多い傾向にある。',
      '江戸時代の浮世絵にもたびたび描かれている、歴史ある柄。',
      '体力があり、丈夫な子が多いとよく言われる。',
      '「キジシロ」など白との組み合わせもよく見られるバリエーション。',
      '海外でも "Tabby" として広く知られ、猫全体の代名詞的存在になっている。',
      '農家では古くからネズミ捕りとして重宝されてきた歴史がある。',
      '縞模様の濃淡には個体差があり、同じ柄は二つとないと言われる。',
      '賢く警戒心も適度にあり、バランスの取れた性格の子が多い。',
      '日本の「招き猫」のモデルにも、タビー柄が使われることがある。',
      '野良猫として暮らす個体も多く、たくましい生命力を持つ。',
      '海外の伝承では、幸運を呼ぶ柄ともされている。',
      '同じ模様に見えても毛色のベースが違うと呼び名が変わる(キジ白・サビキジなど)。',
      'その素朴な佇まいから「日本の猫の原点」とも呼ばれることがある。',
      'ありふれているようで、実は一匹一匹模様が違う個性豊かな柄。',
    ],
    specialFact: '野に生きるキジトラのようにたくましく駆け抜けた証——1万点、お見事。',
  },
  S: {
    name: 'メインクーン',
    personality: '穏やかで頼れる「優しい巨人」',
    trivia: '耳先の房毛がトレードマーク。アメリカ原産の猫種の中でも最大級の体格。',
    milestoneFacts: [
      'アメリカ・メイン州原産で、同州の「州猫」に指定されている。',
      '耳先の房毛(リンクスティップ)が特徴的で、寒さから耳を守る役割があるとされる。',
      '家猫の中でも最大級の体格を誇り、体長1mを超える個体もいる。',
      'ふさふさの尻尾は、寒い時にマフラーのように体へ巻きつけて使う。',
      '「穏やかな巨人(ジェントル・ジャイアント)」という愛称で親しまれている。',
      '水を怖がらない珍しい猫種としても知られている。',
      '足先の指の間にも長い毛が生え、雪上を歩くスノーシューのような役割を果たす。',
      '起源には諸説あり、船に乗って渡ってきた猫がルーツという説もある。',
      '鳴き声は体の大きさに似合わず、小さく可愛らしいことが多い。',
      '成長がゆっくりで、大人の体格になるまで3〜5年かかることもある。',
      '被毛は3層構造になっており、厳しい寒さに耐えられるようになっている。',
      '歴代の「世界一長い猫」としてギネス記録を持ったこともある品種。',
      '見た目は野性的だが、性格は非常に穏やかで人懐っこい。',
      'アメリカ最古の猫種のひとつとされ、19世紀にはすでに記録が残る。',
      '犬のように飼い主の後をついて歩く子が多いと言われる。',
      '大きな体を持ちながら、器用に物を持ち上げる仕草を見せることもある。',
      '寒冷地の農場で、ネズミ捕りとして活躍していた歴史を持つ。',
      '骨太でがっしりしており、成猫の体重は10kgに達することもある。',
      '一時は人気が落ち込んだが、20世紀の保護活動により復活を遂げた。',
      '賢く芸を覚えるのが得意で、フェッチ(物を取ってくる遊び)をする子もいる。',
      'その堂々とした姿から「猫界の王者」とも呼ばれる。',
    ],
    specialFact: '穏やかな巨人が持つ底知れぬ力のように——1万点、まさに王者の風格。',
  },
  Z: {
    name: 'スコティッシュフォールド',
    personality: 'おっとりマイペース、順応力抜群',
    trivia: '折れ耳が特徴で、1960年代にスコットランドの農場で発見されたのが起源。',
    milestoneFacts: [
      '1961年、スコットランドの農場で見つかった1匹の折れ耳猫がルーツとされる。',
      '折れ耳は軟骨に関する遺伝的特徴で、生まれた時は耳がまっすぐな子も多い。',
      '耳が折れているかどうかは、生後3〜4週間ほどで決まってくる。',
      '丸い顔と大きな瞳で「フクロウのような表情」と称されることがある。',
      '座り方が独特で、後ろ足を投げ出して座る通称「スコ座り」で有名。',
      '性格は穏やかで人懐っこく、鳴き声も比較的静か。',
      '元々はイギリス発祥だが、その後の品種改良は主にアメリカで進んだ。',
      '耳が真っ直ぐな「スコティッシュストレート」という兄弟品種も存在する。',
      '骨格に関わる遺伝のため、健康管理には配慮が必要な猫種として知られる。',
      '表情が乏しく見えることがあり「ポーカーフェイス」と呼ばれることも。',
      '好奇心旺盛で、新しい環境にも比較的すぐ慣れる。',
      'SNS映えする愛らしい見た目で、世界的に人気が高まった品種。',
      'おっとりした性格で、多頭飼いや子供のいる家庭にも向いていると言われる。',
      '折れ耳の角度には個体差があり、ぺたんと寝た耳から軽く折れた耳まで様々。',
      '遊び好きな一面もあり、意外と活発に動き回ることもある。',
      '丸みを帯びた体つきで、全体的に「まんまる」な印象を与える。',
      '国によっては、繁殖に関する規制やガイドラインが設けられている品種。',
      '賢く、飼い主の生活リズムを覚えて行動する子も多い。',
      '甘えん坊な性格で、そばにいたがる子が多いとされる。',
      'その愛らしい姿から、世界中でセレブにも愛されている品種。',
      '一度見たら忘れられない、唯一無二のシルエットを持つ猫種。',
    ],
    specialFact: '折れ耳の奥に秘めたおっとりパワーが弾ける瞬間——1万点到達、お見事。',
  },
  J: {
    name: 'バーミーズ',
    personality: '社交的で人にべったり甘えたがり',
    trivia: 'かつては「シャムの親戚」と考えられていたほど人懐っこい猫種。',
    milestoneFacts: [
      '1930年代にアメリカへ渡った1匹の雌猫「ウォン・マウ」がルーツとされる。',
      'かつてはシャム猫の一種と考えられていたほど、近い血縁を持つ。',
      '筋肉質でずっしり重く、見た目より重量感がある「ブリックインシルク」体型。',
      '非常に社交的で、来客にも物怖じせず近づいていく子が多い。',
      '艶やかな短毛で、まるで絹のような手触りが特徴。',
      '鳴き声は控えめだが、感情表現は豊かで甘え上手。',
      'ミャンマー(旧ビルマ)が名前の由来とされている。',
      '好奇心旺盛で、飼い主のすることに何でも興味を示す。',
      '一頭だけより、猫同士や人と一緒にいることを好む傾向がある。',
      '瞳は金色や黄色みを帯びたものが多く、深みのある色合いを持つ。',
      '賢く、簡単なコマンドや芸を覚えられる子も多い。',
      '抱っこや膝の上でくつろぐのが大好きな甘えん坊。',
      '毛色はセーブル(濃い茶色)が特に有名だが、複数のカラーが存在する。',
      '遊び好きで、大人になってもやんちゃな一面を残す子が多い。',
      '声はよく通るが、シャム猫ほど鳴き続けることは少ない。',
      '人と一緒に眠るのを好む、寂しがり屋な一面もある。',
      '手先が器用で、ドアノブや引き出しを開けてしまうこともある。',
      '家族全員にまんべんなく甘える、社交的な性格で知られる。',
      '猫種としての歴史は比較的新しいが、根強いファンを持つ。',
      'その人懐っこさから「膝の上の猫」とも称される。',
      '一度暮らすと手放せなくなるという愛好家が多い品種。',
    ],
    specialFact: '人懐っこいバーミーズも思わず尻尾を立てる快挙——1万点達成おめでとう。',
  },
  L: {
    name: '茶トラ',
    personality: '食いしん坊で愛嬌たっぷり',
    trivia: 'オレンジ猫はオスの割合が多いことで知られる、日本でも大人気の柄。',
    milestoneFacts: [
      'オレンジ色の毛は「O遺伝子」という性染色体上の遺伝子によって決まる。',
      'この遺伝の仕組みにより、茶トラのオスはメスよりずっと多く生まれる。',
      '「猫は太りやすい」というイメージが強い柄だが、実際は個体差が大きい。',
      '海外では "Ginger cat" と呼ばれ、多くの創作作品にも登場する人気の柄。',
      '縞模様の濃淡は個体ごとに異なり、同じ柄は存在しないと言われる。',
      '性格はフレンドリーで人懐っこい子が多いとよく言われる、人気の理由のひとつ。',
      '有名な漫画やアニメの人気キャラクターに、茶トラ柄が多いのも特徴。',
      '「デブ猫」キャラの定番として、世界中で親しまれている。',
      '毛色と性格に科学的な因果関係は証明されていないが、根強い人気説がある。',
      '野良猫の中でも見かける機会が多い、身近な柄のひとつ。',
      '食いしん坊なイメージからグッズやキャラクターのモチーフにされやすい。',
      '明るい毛色は屋外でもよく目立ち、人に見つかりやすい柄でもある。',
      '海外の有名な猫キャラクターにも、茶トラがモデルになった例が多い。',
      '毛色が濃いオレンジから薄いクリーム系まで、幅広いバリエーションがある。',
      '日向ぼっこが大好きで、暖かい場所によく陣取る。',
      'SNSでは「まんまるな茶トラ」の投稿が特に人気を集めやすい。',
      'その愛嬌のある見た目から、猫カフェの人気者になることも多い。',
      '遺伝的な仕組み上、茶トラの三毛猫(メス)は非常に珍しい。',
      '食への関心が強いとされ、おやつの時間に敏感な子が多いとも言われる。',
      '明るい毛色と人懐っこさで、猫を初めて飼う人にも好まれやすい。',
      '愛嬌満点、まさに「みんなに愛される猫」の代名詞的存在。',
    ],
    specialFact: '食いしん坊な茶トラもびっくりの大記録——1万点、お腹いっぱいの快挙です。',
  },
};

const SHAPES = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

export function createPiece(type) {
  return {
    type,
    rotation: 0,
    x: Math.floor(CONFIG.COLS / 2) - 2,
    y: 0,
  };
}

// Absolute board cells for a piece at its current position/rotation.
export function getCells(piece) {
  const shape = SHAPES[piece.type][piece.rotation];
  return shape.map(([dx, dy]) => ({ x: piece.x + dx, y: piece.y + dy }));
}

// Absolute board cells for a piece rotated by `dir` (+1 / -1), without
// mutating the piece — caller checks validity before committing.
export function getRotatedCells(piece, dir) {
  const rotation = (piece.rotation + dir + 4) % 4;
  const shape = SHAPES[piece.type][rotation];
  return {
    rotation,
    cells: shape.map(([dx, dy]) => ({ x: piece.x + dx, y: piece.y + dy })),
  };
}

function shuffledBag() {
  const bag = [...PIECE_TYPES];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// Standard 7-bag randomizer: every piece type appears exactly once per
// bag, so droughts (e.g. no I-piece for 20 pieces) can't happen.
export function makePieceQueue() {
  let bag = shuffledBag();
  return {
    next() {
      if (bag.length === 0) bag = shuffledBag();
      return createPiece(bag.pop());
    },
  };
}
