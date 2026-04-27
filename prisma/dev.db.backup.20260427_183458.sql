PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
);
INSERT INTO _prisma_migrations VALUES('a411acdd-cd55-4683-9245-125ff817c40c','03f68667dced322bde3c04f01a4786d4e16856ce78ccf716c73157a77b554d02',1775912607099,'20260404035649_add_user_preference_and_audit_log',NULL,NULL,1775912607081,1);
INSERT INTO _prisma_migrations VALUES('4e19a6fb-9435-4857-835b-23d8a9dbad6e','b73f1d9b62028325a55c5850ad73f7394e9f06cfa015947a40e017ccd2ace7b9',1775912607107,'20260404100626_add_analytics_and_quality_score',NULL,NULL,1775912607100,1);
INSERT INTO _prisma_migrations VALUES('6f9985e0-8685-4bc2-a4a3-78ca5417f015','33ab59f5f6a8f26358e55109aba547a704a8c24daa63324da8e234e20f00a167',1775912607112,'20260404111822_add_translation_record',NULL,NULL,1775912607108,1);
INSERT INTO _prisma_migrations VALUES('ce080e26-7f1e-4099-8079-639c97f7234a','996fe46faee13bf14a5310cb5daddea935fbbe93dc30ce62dc31a73a25eca8b2',1775912607118,'20260404120215_add_request_hash',NULL,NULL,1775912607112,1);
INSERT INTO _prisma_migrations VALUES('3be90bff-b3cc-45be-b54a-28eb0e1cf5a6','0f87b806787225119c148759b166a681eab37954c60e1c8d937a461b1130a323',1775912607209,'20260411130327_add_ignored_word_model',NULL,NULL,1775912607206,1);
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "banExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO User VALUES('cmnue9m0f0004146ky4bknum7','creator','$2b$10$AtisnLMy56aJWINlyBgrFePUB7t/Rbm7lnJJndwx3sP1y5JO/JTDu',1,0,NULL,NULL,1775915552175,1775916410709);
INSERT INTO User VALUES('cmnv8lgpu00cw146k39iyshd5','tester','$2b$10$AT2ImIi.UqNueEJckOFIpuz.5jJGSv6JuDER2TTOH2LUgybB/cjHy',0,0,NULL,NULL,1775966493666,1775966493666);
CREATE TABLE IF NOT EXISTS "Word" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "incorrectCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Word_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO Word VALUES('cmnuup87z0084146krwju8qr6','let','/let/','v.','v. 让，允许；出租',replace('Let me help you with that.\nShe decided to let her apartment for the summer.','\n',char(10)),replace('让我来帮你处理那个。\n她决定夏天把她的公寓租出去。','\n',char(10)),0,1,1775943154655,1775943154655,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuupbee0086146ksw6gnc43','html','/ˌeɪtʃ tiː em ˈel/','abbr.','超文本标记语言','HyperText Markup Language','超文本标记语言',0,1,1775943158774,1775943158774,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuupd6j0088146kmggqivv6','hi there','/haɪ ðeər/','phrase','你好；喂（一种非正式的问候语，用于引起注意或打招呼）','"Hi there!" she said with a friendly wave.','“你好！”她友好地挥了挥手说道。',0,1,1775943161083,1775943161083,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuupec2008a146khvy9i5d2','a','/ə/','art.','art. 一个（用于单数可数名词前，表示非特指）','I saw a bird in the tree.','我看见树上有只鸟。',0,1,1775943162578,1775943162578,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuutbjk008d146k0l11959y','123','/wʌn ˈtuː ˈθriː/','num.','num. 一百二十三','The number is one hundred and twenty-three.','这个数字是一百二十三。',0,0,1775943345583,1775943346850,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuutbjy008g146k40ofbhwm',replace('apple\n\n\n\nbanana','\n',char(10)),'/ˈæpl/ /bəˈnɑːnə/','n./n.','n. [C] 苹果；n. [C] 香蕉',replace('I like to eat an apple.\nA banana is a good source of potassium.','\n',char(10)),replace('我喜欢吃苹果。\n香蕉是钾的良好来源。','\n',char(10)),0,0,1775943345599,1775943346852,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuutbk8008j146kvhv46rz4','apple	banana','/ˈæpl/ /bəˈnɑːnə/','n./n.','n. [C] 苹果；n. [C] 香蕉',replace('I like to eat an apple.\nA banana is a good source of potassium.','\n',char(10)),replace('我喜欢吃苹果。\n香蕉是钾的良好来源。','\n',char(10)),0,0,1775943345608,1775943346857,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuutbkd008m146kvlvghsqt','hel​lo','/həˈləʊ/','int./n.','int. 喂，你好；n. [C] 问候',replace('int. Hello, how are you?\nn. She gave me a friendly hello.','\n',char(10)),replace('int. 你好，你怎么样？\nn. 她友好地向我打了个招呼。','\n',char(10)),0,0,1775943345613,1775943346859,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuutbkn008p146kfw3prd9e','hello!','/həˈləʊ/','int./n.','int. 喂，你好；n. [C] 问候',replace('int. Hello, how are you?\nn. She gave me a friendly hello.','\n',char(10)),replace('int. 你好，你怎么样？\nn. 她友好地向我打了个招呼。','\n',char(10)),0,0,1775943345623,1775943346861,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuutbks008s146k5ovivazj','https://example.com',NULL,'phrase','n. [C] 网址，链接','Please visit the website at https://example.com.','请访问网址 https://example.com。',0,0,1775943345629,1775943346864,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuuywm9009i146kcuoqpucd','ai','/ˌeɪ ˈaɪ/','abbr.','人工智能','Artificial Intelligence','人工智能',0,0,1775943606176,1775980790509,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuuywmi009l146kvtfdhfgf','apple','/ˈæpl/','n.','n. [C] 苹果；苹果公司',replace('She ate a red apple for a snack.\nApple Inc. is a leading technology company.','\n',char(10)),replace('她吃了一个红苹果当零食。\n苹果公司是一家领先的科技公司。','\n',char(10)),0,0,1775943606186,1775943607432,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuuywmu009s146k4tz56n4z','javascript','/ˈdʒɑːvəskrɪpt/','n.','n. [U] JavaScript（一种编程语言）','JavaScript is commonly used for web development.','JavaScript常用于网页开发。',0,0,1775943606199,1775980790512,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuv191p00a9146kflzvc1qx','hello','/həˈləʊ/','interj./n.','interj. 喂，你好； n. [C] 问候',replace('interj. Hello, how are you?\nn. She gave a friendly hello to everyone.','\n',char(10)),replace('interj. 你好，最近怎么样？\nn. 她对每个人都友好地问候了一声。','\n',char(10)),0,0,1775943715597,1775943721137,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuv1ceh00ab146k4n2u159x','bonjour','/bɔ̃.ʒuʁ/','interj.','interj. 你好，日安（法语问候语）','Bonjour, comment allez-vous ?','你好，您身体好吗？',0,0,1775943719945,1775943721141,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuv31v700ak146kipa6cekg','cafe','/ˈkæfeɪ/','n.','n. [C] 咖啡馆，小餐馆','Let''s meet at the cafe on the corner.','我们在街角的咖啡馆见面吧。',0,0,1775943799603,1775943800872,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnuv31vh00an146k0mlvnara','et cetera','/ˌet ˈsetərə/','adv.','adv. 等等，以及其他','We need to buy fruits, vegetables, bread, et cetera.','我们需要买水果、蔬菜、面包等等。',0,0,1775943799613,1775943800875,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8cd4l00ax146kwvvgs2lk','hi.','/haɪ/','interj.','interj. 嗨，你好（打招呼用语）','Hi, how are you doing today?','嗨，你今天过得怎么样？',0,0,1775966069104,1775966070307,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8cd5000b0146ksj8ygg6m','no way.','/ˈnəʊ weɪ/','phrase','phrase 不可能；绝不；没门','You got the job? No way!','你得到那份工作了？不可能！',0,0,1775966069124,1775966070309,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8cd5c00b3146k9ms2nze0','oh no!','/əʊ nəʊ/','interj.','interj. 哦不！糟了！（表示惊讶、失望或担忧）','Oh no! I forgot my keys inside.','哦不！我把钥匙忘在里面了。',0,0,1775966069136,1775966070311,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8cd5q00b6146k39rq8tl1','what?','/wɒt/','interj.','interj. 什么？（表示惊讶、疑问或没听清）','What? I didn''t hear you clearly.','什么？我没听清你说的话。',0,0,1775966069150,1775966070319,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8gp7500bm146kbrz0tq82','take for granted','/teɪk fɔːr ˈɡræntɪd/','phrase','认为...理所当然；想当然','We often take for granted the basic necessities of life.','我们常常把生活的基本必需品视为理所当然。',0,0,1775966271377,1775966284107,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8gxzw00bo146kta1w0xnm','get rid of it','/ɡet rɪd ɒv ɪt/','phrase','摆脱它；处理掉它；去掉它','I need to get rid of this old furniture.','我需要处理掉这些旧家具。',0,0,1775966282779,1775966284110,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8gy0f00br146ksuwyquhs','green apple','/ɡriːn ˈæpl/','n.','n. [C] 青苹果','She prefers the tart taste of a green apple.','她更喜欢青苹果的酸味。',0,0,1775966282799,1775966284117,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8gy0l00bu146k5nl424ez','how come','/haʊ kʌm/','phrase','怎么会；为什么','How come you didn''t tell me about the party?','你怎么没告诉我派对的事？',0,0,1775966282805,1775966284122,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8gy0r00bx146kzptxe9pw','look forward to seeing','/lʊk ˈfɔːwəd tuː ˈsiːɪŋ/','phrase','期待见到','I look forward to seeing you at the meeting.','我期待在会议上见到你。',0,0,1775966282811,1775966284126,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8j3zj00cf146kjlcawws4','what''s up','/wʌts ʌp/','phrase','问候语：最近怎么样？/ 怎么了？','Hey, what''s up? Haven''t seen you in a while.','嘿，最近怎么样？好久没见你了。',0,0,1775966383855,1775966389225,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8j77j00ch146kknwegq5o','don''t you know','/doʊnt juː noʊ/','phrase','难道你不知道吗？','Don''t you know the meeting starts at 3 PM?','难道你不知道会议下午三点开始吗？',0,0,1775966388031,1775966389227,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8kghj00cq146ku8817w3o','check','/tʃek/','v./n./int.','v. 检查，核对；制止，抑制；托运，寄存；n. [C] 检查，核对；支票，账单；方格图案；int. （国际象棋）将军',replace('v. Please check your answers before submitting.\nn. I''ll pay the check.\nn. She wore a shirt with a blue and white check.\nint. Check!','\n',char(10)),replace('v. 提交前请检查你的答案。\nn. 我来付账。\nn. 她穿了一件蓝白格子的衬衫。\nint. 将军！','\n',char(10)),0,0,1775966446712,1775966447885,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8m7vw00cy146kb2c2v2gg','dumb','/dʌm/','adj.','adj. 哑的，不能说话的；<非正式>愚蠢的，笨的',replace('adj. He was born deaf and dumb.\nadj. That was a really dumb mistake.','\n',char(10)),replace('adj. 他天生又聋又哑。\nadj. 那真是个非常愚蠢的错误。','\n',char(10)),0,0,1775966528874,1775966530152,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8m84e00d2146k5yxvcwz8','dumb','/dʌm/','adj.','adj. 哑的，不能说话的；<非正式>愚蠢的，笨的',replace('adj. He was born deaf and dumb.\nadj. That was a really dumb mistake.','\n',char(10)),replace('adj. 他天生又聋又哑。\nadj. 那真是个非常愚蠢的错误。','\n',char(10)),0,0,1775966529183,1775966530511,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8oaev00d9146kb6ts69dl','eight','/eɪt/','n./adj.','n. [C] 八；adj. 八的',replace('n. The number after seven is eight.\nadj. There are eight planets in our solar system.','\n',char(10)),replace('n. 七后面的数字是八。\nadj. 我们的太阳系有八颗行星。','\n',char(10)),0,0,1775966625461,1775966626720,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oafa00dc146keap14p0h','five','/faɪv/','n./adj.','n. [C] 五；adj. 五的',replace('n. A hand has five fingers.\nadj. I''ll meet you in five minutes.','\n',char(10)),replace('n. 一只手有五根手指。\nadj. 我五分钟后见你。','\n',char(10)),0,0,1775966625478,1775966626724,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oafi00df146ks744tyc5','four','/fɔːr/','n./adj.','n. [C] 四；adj. 四的',replace('n. A square has four sides.\nadj. There are four seasons in a year.','\n',char(10)),replace('n. 正方形有四条边。\nadj. 一年有四个季节。','\n',char(10)),0,0,1775966625486,1775966626726,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oafv00di146kvr8mwfts','nine','/naɪn/','n./adj.','n. [C] 九；adj. 九的',replace('n. A cat is said to have nine lives.\nadj. The meeting starts at nine o''clock.','\n',char(10)),replace('n. 据说猫有九条命。\nadj. 会议九点开始。','\n',char(10)),0,0,1775966625499,1775966626728,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oafz00dl146ktz0m9ww1','one','/wʌn/','n./adj./pron.','n. [C] 一；adj. 一个的；pron. 一个（人/物）',replace('n. One plus one equals two.\nadj. I have one brother.\npron. This is a good one.','\n',char(10)),replace('n. 一加一等于二。\nadj. 我有一个兄弟。\npron. 这是个好（东西）。','\n',char(10)),0,0,1775966625504,1775966626731,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oag400do146k38hpzs9x','seven','/ˈsev.ən/','n./adj.','n. [C] 七；adj. 七的',replace('n. There are seven days in a week.\nadj. The seven wonders of the world are famous.','\n',char(10)),replace('n. 一周有七天。\nadj. 世界七大奇迹很有名。','\n',char(10)),0,0,1775966625508,1775966626735,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oaga00dr146kooakgm5n','six','/sɪks/','n./adj.','n. [C] 六；adj. 六的',replace('n. A standard guitar has six strings.\nadj. I have six apples.','\n',char(10)),replace('n. 一把标准吉他有六根弦。\nadj. 我有六个苹果。','\n',char(10)),0,0,1775966625514,1775966626739,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oagh00du146k8m6bulaz','ten','/ten/','n./adj.','n. [C] 十；adj. 十的',replace('n. Ten is a round number.\nadj. I scored ten out of ten on the quiz.','\n',char(10)),replace('n. 十是一个整数。\nadj. 我在小测验中得了十分（满分）。','\n',char(10)),0,0,1775966625522,1775966626741,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oagm00dx146k5uiwhvzp','three','/θriː/','n./adj.','n. [C] 三；adj. 三的',replace('n. A triangle has three sides.\nadj. I have three books to read.','\n',char(10)),replace('n. 三角形有三条边。\nadj. 我有三本书要读。','\n',char(10)),0,0,1775966625526,1775966626744,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8oagr00e0146kccvo6b0z','two','/tuː/','n./adj.','n. [C] 二；adj. 二的',replace('n. Two is the smallest prime number.\nadj. I have two hands.','\n',char(10)),replace('n. 二是最小的质数。\nadj. 我有两只手。','\n',char(10)),0,0,1775966625531,1775966626749,'cmnv8lgpu00cw146k39iyshd5');
INSERT INTO Word VALUES('cmnv8ofpz00ex146kcccr5cvq','eight','/eɪt/','num./n.','num. 八；n. [C] 八，八字形',replace('num. She has eight apples.\nn. The figure eight is a common symbol.','\n',char(10)),replace('num. 她有八个苹果。\nn. 数字8是一个常见的符号。','\n',char(10)),0,0,1775966632343,1775966633535,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofq800ez146khdhgx50i','five','/faɪv/','num./n.','num. 五；n. [C] 五，五美元钞票',replace('num. The meeting starts at five o''clock.\nn. Can you break a five?','\n',char(10)),replace('num. 会议五点开始。\nn. 你能破开一张五美元钞票吗？','\n',char(10)),0,0,1775966632353,1775966633539,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofqb00f1146k3hj55bmy','four','/fɔːr/','num./n.','num. 四；n. [C] 四，四人划艇队',replace('num. There are four seasons in a year.\nn. He rows in a four.','\n',char(10)),replace('num. 一年有四个季节。\nn. 他在四人划艇队划船。','\n',char(10)),0,0,1775966632355,1775966633544,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofqd00f3146kcv1n0k29','nine','/naɪn/','num./n.','num. 九；n. [C] 九，九号',replace('num. A cat has nine lives.\nn. He wears the number nine jersey.','\n',char(10)),replace('num. 猫有九条命。\nn. 他穿着9号球衣。','\n',char(10)),0,0,1775966632357,1775966633546,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofqf00f5146kzmjgwa66','one','/wʌn/','num./pron./adj.','num. 一；pron. 一个人，任何人；adj. 唯一的，同一的',replace('num. I have one brother.\npron. One should always be honest.\nadj. They are of one mind.','\n',char(10)),replace('num. 我有一个兄弟。\npron. 人应该永远诚实。\nadj. 他们意见一致。','\n',char(10)),0,0,1775966632359,1775966633548,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofqh00f7146k4z99bbc8','seven','/ˈsev.ən/','num./n.','num. 七；n. [C] 七，七人一组',replace('num. There are seven days in a week.\nn. They formed a seven to tackle the project.','\n',char(10)),replace('num. 一周有七天。\nn. 他们组成了一个七人小组来应对这个项目。','\n',char(10)),0,0,1775966632362,1775966633549,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofqj00f9146klq8q05il','six','/sɪks/','num./n.','num. 六；n. [C] 六，六分',replace('num. A standard guitar has six strings.\nn. He scored a six in cricket.','\n',char(10)),replace('num. 一把标准吉他有六根弦。\nn. 他在板球中得了六分。','\n',char(10)),0,0,1775966632364,1775966633553,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofql00fb146khldvd2gs','ten','/ten/','num./n.','num. 十；n. [C] 十，十美元钞票',replace('num. She will arrive in ten minutes.\nn. I only have a ten in my wallet.','\n',char(10)),replace('num. 她将在十分钟后到达。\nn. 我钱包里只有一张十美元钞票。','\n',char(10)),0,0,1775966632366,1775966633557,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofqn00fd146kfm89jjms','three','/θriː/','num./n.','num. 三；n. [C] 三，三号',replace('num. They have three children.\nn. His favorite number is three.','\n',char(10)),replace('num. 他们有三个孩子。\nn. 他最喜欢的数字是三。','\n',char(10)),0,0,1775966632368,1775966633559,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnv8ofqq00ff146kqv9bxbb8','two','/tuː/','num./n.','num. 二；n. [C] 二，两岁',replace('num. It takes two to tango.\nn. The toddler is almost two.','\n',char(10)),replace('num. 一个巴掌拍不响。\nn. 那个幼儿快两岁了。','\n',char(10)),0,0,1775966632370,1775966633560,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvh3v0x0002axa2v0giakxn','llm','/ˌel el ˈem/','abbr.','大型语言模型','Large Language Model','大型语言模型',0,0,1775980788941,1775980876083,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvtdh7q00025kkidomwdzbz','are','/ɑːr/','v.','v. 是（be 动词的第二人称单复数现在时、第一、三人称复数现在时）','You are my best friend.','你是我最好的朋友。',0,0,1776001392991,1776001394523,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvtdh8v00055kkiaep45d7p','grandson','/ˈɡrænsʌn/','n.','n. [C] 孙子，外孙','My grandson is five years old.','我的孙子五岁了。',0,0,1776001393039,1776001394528,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvtdh9w00085kkizrpgskw4','hi','/haɪ/','interj.','interj. 嗨，你好（非正式问候语）','Hi, how are you doing?','嗨，你好吗？',0,0,1776001393076,1776001394530,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvtdha1000b5kki7zsbs8p9','how','/haʊ/','adv./conj.','adv. 怎样，如何；多么；conj. 怎样，如何',replace('adv. How do you solve this problem?\nadv. How beautiful the scenery is!','\n',char(10)),replace('adv. 你如何解决这个问题？\nadv. 这景色多美啊！','\n',char(10)),0,0,1776001393081,1776001394532,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvtdha6000e5kkickkv7ppk','my','/maɪ/','pron.','pron. 我的（第一人称单数所有格形容词）','This is my book.','这是我的书。',0,0,1776001393086,1776001394534,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvtdhaa000h5kkim7voiznx','now','/naʊ/','adv./n./conj.','adv. 现在，目前；立刻；n. [U] 现在，此刻；conj. 既然，由于',replace('adv. I am busy now.\nn. Now is the time to act.\nconj. Now that you''re here, we can start.','\n',char(10)),replace('adv. 我现在很忙。\nn. 现在是行动的时候了。\nconj. 既然你来了，我们可以开始了。','\n',char(10)),0,0,1776001393090,1776001394535,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvtdhae000k5kkiufpp5hpz','tall','/tɔːl/','adj.','adj. 高的，高大的','He is a very tall basketball player.','他是一名非常高的篮球运动员。',0,0,1776001393095,1776001394538,'cmnue9m0f0004146ky4bknum7');
INSERT INTO Word VALUES('cmnvtdhaj000n5kki49wu23rr','you','/juː/','pron.','pron. 你，你们（第二人称单复数主格和宾格）','You are a great person.','你是一个很棒的人。',0,0,1776001393099,1776001394543,'cmnue9m0f0004146ky4bknum7');
CREATE TABLE IF NOT EXISTS "ReviewGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ReviewGroupWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewGroupId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewGroupWord_reviewGroupId_fkey" FOREIGN KEY ("reviewGroupId") REFERENCES "ReviewGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewGroupWord_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ApiConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1/chat/completions',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPrompt" TEXT,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "SecurityViolation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "violationType" TEXT NOT NULL,
    "inputValue" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "SecurityViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "IpBan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ipAddress" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 1,
    "bannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "isPermanent" BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "defaultShowPos" BOOLEAN NOT NULL DEFAULT true,
    "defaultShowExample" BOOLEAN NOT NULL DEFAULT true,
    "defaultShowPhonetic" BOOLEAN NOT NULL DEFAULT true,
    "dailyGoal" INTEGER NOT NULL DEFAULT 20,
    "reviewReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reviewReminderTime" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "language" TEXT NOT NULL DEFAULT 'zh-CN',
    "danmakuEnabled" BOOLEAN NOT NULL DEFAULT false,
    "danmakuSpeed" REAL NOT NULL DEFAULT 1.0,
    "danmakuOpacity" REAL NOT NULL DEFAULT 0.7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO AnalyticsEvent VALUES('cmnucxacb0000146kfn1evfbj','PAGE_VIEW','cmnjzc3r80016geadf2vaczm4','aikdzx77288vz16cwkthfo','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775913297563);
INSERT INTO AnalyticsEvent VALUES('cmnudrm9h0001146kxmjo12zw','PAGE_VIEW','cmnjzc3r80016geadf2vaczm4','aikdzx77288vz16cwkthfo','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775914712694);
INSERT INTO AnalyticsEvent VALUES('cmnue8y9e0002146k0cvx53jq','PAGE_VIEW','cmnjzc3r80016geadf2vaczm4','aikdzx77288vz16cwkthfo','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775915521393);
INSERT INTO AnalyticsEvent VALUES('cmnue9a480003146kc0ml29lx','PAGE_VIEW','cmnjzc3r80016geadf2vaczm4','aikdzx77288vz16cwkthfo','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775915536760);
INSERT INTO AnalyticsEvent VALUES('cmnuftieq0005146ksxdm4np4','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','lssq638bu3y4ru2fd6tn','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918160243);
INSERT INTO AnalyticsEvent VALUES('cmnufu0l20006146kdweue6x8','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','lssq638bu3y4ru2fd6tn','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918183799);
INSERT INTO AnalyticsEvent VALUES('cmnufuxa50007146ksvel98cj','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','lssq638bu3y4ru2fd6tn','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918226174);
INSERT INTO AnalyticsEvent VALUES('cmnufv8020008146k4jimq87t','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','lssq638bu3y4ru2fd6tn','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918240066);
INSERT INTO AnalyticsEvent VALUES('cmnug246r0009146ksyq93ygb','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','lssq638bu3y4ru2fd6tn','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918561715);
INSERT INTO AnalyticsEvent VALUES('cmnug2l61000y146kwld8s3di','TRANSLATE','cmnue9m0f0004146ky4bknum7','lssq638bu3y4ru2fd6tn','{"wordCount":6,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918583721);
INSERT INTO AnalyticsEvent VALUES('cmnug9wd9001p146kmv07bvmb','TRANSLATE','cmnue9m0f0004146ky4bknum7','lssq638bu3y4ru2fd6tn','{"wordCount":5,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918924829);
INSERT INTO AnalyticsEvent VALUES('cmnugk5fh002c146kdje2pv0q','TRANSLATE','cmnue9m0f0004146ky4bknum7','lssq638bu3y4ru2fd6tn','{"wordCount":5,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775919403133);
INSERT INTO AnalyticsEvent VALUES('cmnur23ja002l146kif5z9t8k','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775937036635);
INSERT INTO AnalyticsEvent VALUES('cmnur5yz50030146kh8yk2b9r','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":6,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775937217362);
INSERT INTO AnalyticsEvent VALUES('cmnurjmto003h146k70fl5sjn','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775937854797);
INSERT INTO AnalyticsEvent VALUES('cmnurnoqp003i146kx82a155v','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938043904);
INSERT INTO AnalyticsEvent VALUES('cmnurog4q003j146k4wf2rftq','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938079402);
INSERT INTO AnalyticsEvent VALUES('cmnursl55003q146kvg9ofzs9','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938272522);
INSERT INTO AnalyticsEvent VALUES('cmnursre8003r146kb3qgmkza','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938280624);
INSERT INTO AnalyticsEvent VALUES('cmnuru2ux003s146k1hd5bjav','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938342138);
INSERT INTO AnalyticsEvent VALUES('cmnurvadz003t146k468n3412','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":4,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938398551);
INSERT INTO AnalyticsEvent VALUES('cmnus61rg0040146kr8v8pw14','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938900588);
INSERT INTO AnalyticsEvent VALUES('cmnus7twq0044146kseol4swv','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938983722);
INSERT INTO AnalyticsEvent VALUES('cmnusr4690046146k0c9bl7si','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775939883490);
INSERT INTO AnalyticsEvent VALUES('cmnusz51t0047146k9bbnp3pq','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":50,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775940257873);
INSERT INTO AnalyticsEvent VALUES('cmnut4z570072146k9qoi7g82','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775940530156);
INSERT INTO AnalyticsEvent VALUES('cmnut5am40079146kn7t4nxud','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775940545020);
INSERT INTO AnalyticsEvent VALUES('cmnutabvh007a146k9zfs0ftq','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775940779926);
INSERT INTO AnalyticsEvent VALUES('cmnutm0nr007h146k98t805r4','TRANSLATE','cmnue9m0f0004146ky4bknum7','hexsaudalz54l3tvrnvi3u','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775941325271);
INSERT INTO AnalyticsEvent VALUES('cmnuup4rg0082146kif9cbm7m','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943150172);
INSERT INTO AnalyticsEvent VALUES('cmnuupi44008b146kqzlch5a2','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943167477);
INSERT INTO AnalyticsEvent VALUES('cmnuutcis0094146kwv3tejxi','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":11,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943346852);
INSERT INTO AnalyticsEvent VALUES('cmnuuwuru009g146kpmxvz92h','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":6,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943510475);
INSERT INTO AnalyticsEvent VALUES('cmnuuyxkx009z146ke9pm4eq1','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":5,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943607425);
INSERT INTO AnalyticsEvent VALUES('cmnuv1dbp00ag146k079prifc','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":9,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943721141);
INSERT INTO AnalyticsEvent VALUES('cmnuv32un00av146kj4x7ea5f','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":4,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943800879);
INSERT INTO AnalyticsEvent VALUES('cmnv8ce1x00be146kb4rd36d0','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":9,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966070309);
INSERT INTO AnalyticsEvent VALUES('cmnv8gz0t00c5146kdaafi91z','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":8,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966284110);
INSERT INTO AnalyticsEvent VALUES('cmnv8j84q00cm146k021u8zxo','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":4,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966389227);
INSERT INTO AnalyticsEvent VALUES('cmnv8khe700cv146kwr49hdp0','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966447888);
INSERT INTO AnalyticsEvent VALUES('cmnv8m98800d7146k7apyab0g','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966530616);
INSERT INTO AnalyticsEvent VALUES('cmnv8ogn700fs146k4mq6w6fn','TRANSLATE','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"wordCount":10,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966633539);
INSERT INTO AnalyticsEvent VALUES('cmnv90qz400gf146k3c522bt2','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"charCount":539}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775967206800);
INSERT INTO AnalyticsEvent VALUES('cmnv940tx00gg146kjlfk1rsl','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"charCount":1357}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775967359541);
INSERT INTO AnalyticsEvent VALUES('cmnv9dq2200gh146kbaoapm7n','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"charCount":5535}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775967812138);
INSERT INTO AnalyticsEvent VALUES('cmnv9g4d300gi146k33v9k29f','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','1ff7fg767aes7hfqlr0bo','{"charCount":7954}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775967923991);
INSERT INTO AnalyticsEvent VALUES('cmnvgteja0000axa2vp2vyyn2','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775980301013);
INSERT INTO AnalyticsEvent VALUES('cmnvh3w070005axa2ce435etx','TRANSLATE','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"wordCount":3,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775980790215);
INSERT INTO AnalyticsEvent VALUES('cmnvh5q9i000faxa2glk67x2t','TRANSLATE','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"wordCount":1,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775980876086);
INSERT INTO AnalyticsEvent VALUES('cmnvh5z3o000gaxa2qo5vsm66','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775980887540);
INSERT INTO AnalyticsEvent VALUES('cmnvhuf9c000haxa20ti4ba7l','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982028215);
INSERT INTO AnalyticsEvent VALUES('cmnvhypv4000iaxa221rnzecu','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"charCount":1740}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982228592);
INSERT INTO AnalyticsEvent VALUES('cmnvi06bx000jaxa24vnm3ca8','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982296589);
INSERT INTO AnalyticsEvent VALUES('cmnvi269z000kaxa20lbzg959','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"charCount":1741}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982389831);
INSERT INTO AnalyticsEvent VALUES('cmnvi4w30000laxa21peoxarw','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"charCount":17}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982516588);
INSERT INTO AnalyticsEvent VALUES('cmnvi7it5000maxa2w86an9db','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"charCount":2}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982639353);
INSERT INTO AnalyticsEvent VALUES('cmnvi9n2p000naxa2d3bpw1l4','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"charCount":86}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982738193);
INSERT INTO AnalyticsEvent VALUES('cmnvidv49000oaxa21eienoas','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982935234);
INSERT INTO AnalyticsEvent VALUES('cmnvif5up0000rmz460hsr3dl','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775982995806);
INSERT INTO AnalyticsEvent VALUES('cmnvifbpl0001rmz4i2zh8kob','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775983003401);
INSERT INTO AnalyticsEvent VALUES('cmnvig9i30002rmz4kbj39r70','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"charCount":4}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775983047196);
INSERT INTO AnalyticsEvent VALUES('cmnvii7mu0003rmz4fu9lfclf','TRANSLATE_ONLY','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"charCount":32}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775983138086);
INSERT INTO AnalyticsEvent VALUES('cmnvjdl7k0004rmz4u4o9fom9','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775984602016);
INSERT INTO AnalyticsEvent VALUES('cmnvjdto60005rmz4n6icss1b','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','o144unany3aq9bp3ax3y0j','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775984612982);
INSERT INTO AnalyticsEvent VALUES('cmnvtbz8700005kkice7dgbep','PAGE_VIEW','cmnue9m0f0004146ky4bknum7','b1wkt9foxeva9j9nri64jd','{"path":"/","pageName":"Home"}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001323028);
INSERT INTO AnalyticsEvent VALUES('cmnvtdi72000x5kkijmqui6eq','TRANSLATE','cmnue9m0f0004146ky4bknum7','b1wkt9foxeva9j9nri64jd','{"wordCount":8,"cached":false}','::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001394270);
CREATE TABLE IF NOT EXISTS "DailyStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "dau" INTEGER NOT NULL DEFAULT 0,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "translations" INTEGER NOT NULL DEFAULT 0,
    "dictations" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "PublicWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "qualityScore" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO PublicWord VALUES('cmnug2kab000c146kbxuff97x','a','/ə/','art.','art. 一个（用于单数可数名词前，表示非特指）','I saw a bird in the tree.','我看见树上有只鸟。',80,1,1775918582580,1775918582580);
INSERT INTO PublicWord VALUES('cmnug2kaj000f146kcpd6h7bv','example','/ɪɡˈzɑːmpl/','n.','n. [C] 例子，榜样','Can you give me an example of how to use this word?','你能给我一个如何使用这个词的例子吗？',85,1,1775918582588,1775918582588);
INSERT INTO PublicWord VALUES('cmnug2kap000i146kymhpfc4f','hello','/həˈləʊ/','interj./n.','interj. 喂，你好； n. [C] 问候',replace('interj. Hello, how are you?\nn. She gave a friendly hello to everyone.','\n',char(10)),replace('interj. 你好，最近怎么样？\nn. 她对每个人都友好地问候了一声。','\n',char(10)),95,1,1775918582593,1775918582593);
INSERT INTO PublicWord VALUES('cmnug2kav000l146k6yq8xn45','is','/ɪz/','v.','v. 是（be 动词的第三人称单数现在时）','The sky is blue.','天空是蓝色的。',70,1,1775918582600,1775918582600);
INSERT INTO PublicWord VALUES('cmnug2kaz000o146k7q1evwzy','test','/test/','n./v.','n. [C] 测试，测验； v. 测试，考验',replace('n. We have a math test tomorrow.\nv. The teacher will test our knowledge on the subject.','\n',char(10)),replace('n. 我们明天有数学测验。\nv. 老师将测试我们在这个学科上的知识。','\n',char(10)),95,1,1775918582604,1775918582604);
INSERT INTO PublicWord VALUES('cmnug2kb3000r146k96fcpsvd','this','/ðɪs/','pron./det.','pron. 这个，这； det. 这个，这',replace('pron. This is my book.\ndet. I like this song.','\n',char(10)),replace('pron. 这是我的书。\ndet. 我喜欢这首歌。','\n',char(10)),90,1,1775918582608,1775918582608);
INSERT INTO PublicWord VALUES('cmnug9vgl001d146kmq9hdfb0','let','/let/','v.','v. 让，允许；出租',replace('Let me help you with that.\nShe decided to let her apartment for the summer.','\n',char(10)),replace('让我来帮你处理那个。\n她决定夏天把她的公寓租出去。','\n',char(10)),75,1,1775918923654,1775918923654);
INSERT INTO PublicWord VALUES('cmnug9vgx001g146kp6gchraa','try','/traɪ/','v./n.','v. 尝试，努力；审判；n. [C] 尝试，努力',replace('v. You should try this new restaurant.\nn. Give it a try, you might like it.','\n',char(10)),replace('v. 你应该试试这家新餐厅。\nn. 试一试，你可能会喜欢。','\n',char(10)),95,1,1775918923665,1775918923665);
INSERT INTO PublicWord VALUES('cmnug9vh4001j146k2mnb8s7x','us','/ʌs/','pron.','pron. 我们（we的宾格）',replace('She invited us to her party.\nLet us know if you need anything.','\n',char(10)),replace('她邀请我们参加她的派对。\n如果你需要什么，请告诉我们。','\n',char(10)),85,1,1775918923672,1775918923672);
INSERT INTO PublicWord VALUES('cmnugk4h00020146kclql7cpw','do','/duː/','v./aux.v.','v. 做，干；aux.v. 用于构成疑问句、否定句或强调句',replace('v. What do you do for a living?\naux.v. Do you like coffee?','\n',char(10)),replace('v. 你以什么为生？\naux.v. 你喜欢咖啡吗？','\n',char(10)),95,1,1775919401893,1775919401893);
INSERT INTO PublicWord VALUES('cmnugk4hc0023146ks2nwy5pi','the','/ðə/ (辅音前), /ði/ (元音前)','art.','art. 这，那（定冠词）','The book on the table is mine.','桌子上的那本书是我的。',80,1,1775919401904,1775919401904);
INSERT INTO PublicWord VALUES('cmnugk4hm0026146kt5tv3ut4','what','/wɒt/','pron./adj.','pron. 什么；adj. 什么，多么',replace('pron. What is your name?\nadj. What a beautiful day!','\n',char(10)),replace('pron. 你叫什么名字？\nadj. 多么美好的一天啊！','\n',char(10)),95,1,1775919401914,1775919401914);
INSERT INTO PublicWord VALUES('cmnur5y30002o146k5d5nhdsc','for','/fɔːr/ (强读) /fər/ (弱读)','prep./conj.','prep. 为了；给；对于；因为；conj. 因为',replace('prep. This gift is for you.\nconj. She was late, for the bus broke down.','\n',char(10)),replace('prep. 这份礼物是给你的。\nconj. 她迟到了，因为公交车坏了。','\n',char(10)),95,1,1775937216204,1775937216204);
INSERT INTO PublicWord VALUES('cmnur5y3n002r146kmavw39z6','html','/ˌeɪtʃ tiː em ˈel/','abbr.','超文本标记语言','HyperText Markup Language','超文本标记语言',70,1,1775937216227,1775937216227);
INSERT INTO PublicWord VALUES('cmnur5y3y002u146kayuoq3zo','so','/soʊ/','adv./conj./adj./pron.','adv. 如此，这么；非常；conj. 所以，因此；adj. 如此的，这样的；pron. 如此，这样',replace('adv. It''s so hot today.\nconj. I was tired, so I went to bed early.\nadj. He is not so foolish as you think.\npron. I think so.','\n',char(10)),replace('adv. 今天非常热。\nconj. 我累了，所以很早就睡了。\nadj. 他并不像你想的那么傻。\npron. 我想是的。','\n',char(10)),100,1,1775937216239,1775937216239);
INSERT INTO PublicWord VALUES('cmnurjlvn003d146kfku40ray','hi there','/haɪ ðeər/','phrase','你好；喂（一种非正式的问候语，用于引起注意或打招呼）','"Hi there!" she said with a friendly wave.','“你好！”她友好地挥了挥手说道。',80,1,1775937853571,1775937853571);
INSERT INTO PublicWord VALUES('cmnursk6j003m146kdlb26hr1','what''s up','/wʌts ʌp/','phrase','问候语：最近怎么样？/ 怎么了？','Hey, what''s up? Haven''t seen you in a while.','嘿，最近怎么样？好久没见你了。',80,1,1775938271275,1775938271275);
INSERT INTO PublicWord VALUES('cmnus60ua003w146kcgr248pp','take for granted','/teɪk fɔːr ˈɡræntɪd/','phrase','认为...理所当然；想当然','We often take for granted the basic necessities of life.','我们常常把生活的基本必需品视为理所当然。',85,1,1775938899395,1775938899395);
INSERT INTO PublicWord VALUES('cmnut4y92006y146k03pjnx6n','yellow','/ˈjɛləʊ/','adj./n./v.','adj. 黄色的；n. [C, U] 黄色；v. 变黄，发黄',replace('adj. She wore a bright yellow dress.\nn. Yellow is my favorite color.\nv. The old paper had yellowed with age.','\n',char(10)),replace('adj. 她穿了一条亮黄色的裙子。\nn. 黄色是我最喜欢的颜色。\nv. 旧纸张因年代久远已经发黄了。','\n',char(10)),95,1,1775940528999,1775940528999);
INSERT INTO PublicWord VALUES('cmnut59pz0075146k0u6npa9a','goon','/ɡuːn/','n.','n. [C] 1. 蠢人，笨蛋；2. 打手，暴徒',replace('1. Don''t be such a goon.\n2. The company hired goons to intimidate the striking workers.','\n',char(10)),replace('1. 别这么蠢。\n2. 公司雇了打手来恐吓罢工的工人。','\n',char(10)),85,1,1775940543864,1775940543864);
INSERT INTO PublicWord VALUES('cmnutlzqt007d146kdpbd56bj','fluff','/flʌf/','n./v.','n. [U] 绒毛，蓬松物；[C] 无价值的东西，小错误；v. 使蓬松；弄糟，出错',replace('n. There was some fluff on the carpet.\nn. The speech was full of fluff and lacked substance.\nv. She fluffed up the pillows.\nv. The actor fluffed his lines.','\n',char(10)),replace('n. 地毯上有些绒毛。\nn. 这篇演讲充满了空洞的内容，缺乏实质。\nv. 她把枕头拍松了。\nv. 那个演员说错了台词。','\n',char(10)),100,1,1775941324085,1775941324085);
INSERT INTO PublicWord VALUES('cmnuutbjs008e146kczxkmdza','123','/wʌn ˈtuː ˈθriː/','num.','num. 一百二十三','The number is one hundred and twenty-three.','这个数字是一百二十三。',70,1,1775943345592,1775943345592);
INSERT INTO PublicWord VALUES('cmnuutbk2008h146k50fv6947',replace('apple\n\n\n\nbanana','\n',char(10)),'/ˈæpl/ /bəˈnɑːnə/','n./n.','n. [C] 苹果；n. [C] 香蕉',replace('I like to eat an apple.\nA banana is a good source of potassium.','\n',char(10)),replace('我喜欢吃苹果。\n香蕉是钾的良好来源。','\n',char(10)),95,1,1775943345602,1775943345602);
INSERT INTO PublicWord VALUES('cmnuutbka008k146kmee396pk','apple	banana','/ˈæpl/ /bəˈnɑːnə/','n./n.','n. [C] 苹果；n. [C] 香蕉',replace('I like to eat an apple.\nA banana is a good source of potassium.','\n',char(10)),replace('我喜欢吃苹果。\n香蕉是钾的良好来源。','\n',char(10)),95,1,1775943345611,1775943345611);
INSERT INTO PublicWord VALUES('cmnuutbki008n146k9hcyphed','hel​lo','/həˈləʊ/','int./n.','int. 喂，你好；n. [C] 问候',replace('int. Hello, how are you?\nn. She gave me a friendly hello.','\n',char(10)),replace('int. 你好，你怎么样？\nn. 她友好地向我打了个招呼。','\n',char(10)),0,1,1775943345618,1775943345618);
INSERT INTO PublicWord VALUES('cmnuutbkp008q146kiea1kd2u','hello!','/həˈləʊ/','int./n.','int. 喂，你好；n. [C] 问候',replace('int. Hello, how are you?\nn. She gave me a friendly hello.','\n',char(10)),replace('int. 你好，你怎么样？\nn. 她友好地向我打了个招呼。','\n',char(10)),95,1,1775943345625,1775943345625);
INSERT INTO PublicWord VALUES('cmnuutblh008t146kgts07c6g','https://example.com',NULL,'phrase','n. [C] 网址，链接','Please visit the website at https://example.com.','请访问网址 https://example.com。',65,1,1775943345654,1775943345654);
INSERT INTO PublicWord VALUES('cmnuuywme009j146kslu6q446','ai','/ˌeɪ ˈaɪ/','abbr.','人工智能','Artificial Intelligence','人工智能',70,1,1775943606183,1775943606183);
INSERT INTO PublicWord VALUES('cmnuuywml009m146krgn9i5ex','apple','/ˈæpl/','n.','n. [C] 苹果；苹果公司',replace('She ate a red apple for a snack.\nApple Inc. is a leading technology company.','\n',char(10)),replace('她吃了一个红苹果当零食。\n苹果公司是一家领先的科技公司。','\n',char(10)),85,1,1775943606189,1775943606189);
INSERT INTO PublicWord VALUES('cmnuuywmx009t146k3yzn0jh8','javascript','/ˈdʒɑːvəskrɪpt/','n.','n. [U] JavaScript（一种编程语言）','JavaScript is commonly used for web development.','JavaScript常用于网页开发。',80,1,1775943606202,1775943606202);
INSERT INTO PublicWord VALUES('cmnuv1ceo00ac146kyjopefl6','bonjour','/bɔ̃.ʒuʁ/','interj.','interj. 你好，日安（法语问候语）','Bonjour, comment allez-vous ?','你好，您身体好吗？',80,1,1775943719952,1775943719952);
INSERT INTO PublicWord VALUES('cmnuv31vc00al146khbdccu16','cafe','/ˈkæfeɪ/','n.','n. [C] 咖啡馆，小餐馆','Let''s meet at the cafe on the corner.','我们在街角的咖啡馆见面吧。',80,1,1775943799608,1775943799608);
INSERT INTO PublicWord VALUES('cmnuv31vj00ao146k6e8brmqf','et cetera','/ˌet ˈsetərə/','adv.','adv. 等等，以及其他','We need to buy fruits, vegetables, bread, et cetera.','我们需要买水果、蔬菜、面包等等。',85,1,1775943799616,1775943799616);
INSERT INTO PublicWord VALUES('cmnv8cd4u00ay146k19xb9gaa','hi.','/haɪ/','interj.','interj. 嗨，你好（打招呼用语）','Hi, how are you doing today?','嗨，你今天过得怎么样？',80,1,1775966069119,1775966069119);
INSERT INTO PublicWord VALUES('cmnv8cd5700b1146k1yrqk94q','no way.','/ˈnəʊ weɪ/','phrase','phrase 不可能；绝不；没门','You got the job? No way!','你得到那份工作了？不可能！',80,1,1775966069131,1775966069131);
INSERT INTO PublicWord VALUES('cmnv8cd5j00b4146k8q4gqsv6','oh no!','/əʊ nəʊ/','interj.','interj. 哦不！糟了！（表示惊讶、失望或担忧）','Oh no! I forgot my keys inside.','哦不！我把钥匙忘在里面了。',80,1,1775966069143,1775966069143);
INSERT INTO PublicWord VALUES('cmnv8cd5t00b7146kc1k285h5','what?','/wɒt/','interj.','interj. 什么？（表示惊讶、疑问或没听清）','What? I didn''t hear you clearly.','什么？我没听清你说的话。',80,1,1775966069153,1775966069153);
INSERT INTO PublicWord VALUES('cmnv8gy0800bp146kwbe0biux','get rid of it','/ɡet rɪd ɒv ɪt/','phrase','摆脱它；处理掉它；去掉它','I need to get rid of this old furniture.','我需要处理掉这些旧家具。',80,1,1775966282792,1775966282792);
INSERT INTO PublicWord VALUES('cmnv8gy0h00bs146kvkd3nwwa','green apple','/ɡriːn ˈæpl/','n.','n. [C] 青苹果','She prefers the tart taste of a green apple.','她更喜欢青苹果的酸味。',70,1,1775966282802,1775966282802);
INSERT INTO PublicWord VALUES('cmnv8gy0o00bv146krp7b79y5','how come','/haʊ kʌm/','phrase','怎么会；为什么','How come you didn''t tell me about the party?','你怎么没告诉我派对的事？',70,1,1775966282809,1775966282809);
INSERT INTO PublicWord VALUES('cmnv8gy0t00by146kk6nvyv0f','look forward to seeing','/lʊk ˈfɔːwəd tuː ˈsiːɪŋ/','phrase','期待见到','I look forward to seeing you at the meeting.','我期待在会议上见到你。',70,1,1775966282813,1775966282813);
INSERT INTO PublicWord VALUES('cmnv8j77n00ci146kh7xlhg2c','don''t you know','/doʊnt juː noʊ/','phrase','难道你不知道吗？','Don''t you know the meeting starts at 3 PM?','难道你不知道会议下午三点开始吗？',70,1,1775966388035,1775966388035);
INSERT INTO PublicWord VALUES('cmnv8kgho00cr146kvqfvi6lv','check','/tʃek/','v./n./int.','v. 检查，核对；制止，抑制；托运，寄存；n. [C] 检查，核对；支票，账单；方格图案；int. （国际象棋）将军',replace('v. Please check your answers before submitting.\nn. I''ll pay the check.\nn. She wore a shirt with a blue and white check.\nint. Check!','\n',char(10)),replace('v. 提交前请检查你的答案。\nn. 我来付账。\nn. 她穿了一件蓝白格子的衬衫。\nint. 将军！','\n',char(10)),100,1,1775966446716,1775966446716);
INSERT INTO PublicWord VALUES('cmnv8m7wa00cz146kkxb8o8fn','dumb','/dʌm/','adj.','adj. 哑的，不能说话的；<非正式>愚蠢的，笨的',replace('adj. He was born deaf and dumb.\nadj. That was a really dumb mistake.','\n',char(10)),replace('adj. 他天生又聋又哑。\nadj. 那真是个非常愚蠢的错误。','\n',char(10)),85,1,1775966528891,1775966528891);
INSERT INTO PublicWord VALUES('cmnv8oaf400da146k36l40t5g','eight','/eɪt/','n./adj.','n. [C] 八；adj. 八的',replace('n. The number after seven is eight.\nadj. There are eight planets in our solar system.','\n',char(10)),replace('n. 七后面的数字是八。\nadj. 我们的太阳系有八颗行星。','\n',char(10)),95,1,1775966625473,1775966625473);
INSERT INTO PublicWord VALUES('cmnv8oafe00dd146koawohteq','five','/faɪv/','n./adj.','n. [C] 五；adj. 五的',replace('n. A hand has five fingers.\nadj. I''ll meet you in five minutes.','\n',char(10)),replace('n. 一只手有五根手指。\nadj. 我五分钟后见你。','\n',char(10)),95,1,1775966625482,1775966625482);
INSERT INTO PublicWord VALUES('cmnv8oafq00dg146kdc5fn8uq','four','/fɔːr/','n./adj.','n. [C] 四；adj. 四的',replace('n. A square has four sides.\nadj. There are four seasons in a year.','\n',char(10)),replace('n. 正方形有四条边。\nadj. 一年有四个季节。','\n',char(10)),95,1,1775966625494,1775966625494);
INSERT INTO PublicWord VALUES('cmnv8oafx00dj146k6z6ezmb8','nine','/naɪn/','n./adj.','n. [C] 九；adj. 九的',replace('n. A cat is said to have nine lives.\nadj. The meeting starts at nine o''clock.','\n',char(10)),replace('n. 据说猫有九条命。\nadj. 会议九点开始。','\n',char(10)),95,1,1775966625501,1775966625501);
INSERT INTO PublicWord VALUES('cmnv8oag100dm146k8o5jbkbf','one','/wʌn/','n./adj./pron.','n. [C] 一；adj. 一个的；pron. 一个（人/物）',replace('n. One plus one equals two.\nadj. I have one brother.\npron. This is a good one.','\n',char(10)),replace('n. 一加一等于二。\nadj. 我有一个兄弟。\npron. 这是个好（东西）。','\n',char(10)),100,1,1775966625506,1775966625506);
INSERT INTO PublicWord VALUES('cmnv8oag600dp146ktwvw5ji1','seven','/ˈsev.ən/','n./adj.','n. [C] 七；adj. 七的',replace('n. There are seven days in a week.\nadj. The seven wonders of the world are famous.','\n',char(10)),replace('n. 一周有七天。\nadj. 世界七大奇迹很有名。','\n',char(10)),95,1,1775966625510,1775966625510);
INSERT INTO PublicWord VALUES('cmnv8oagf00ds146kdbn09zia','six','/sɪks/','n./adj.','n. [C] 六；adj. 六的',replace('n. A standard guitar has six strings.\nadj. I have six apples.','\n',char(10)),replace('n. 一把标准吉他有六根弦。\nadj. 我有六个苹果。','\n',char(10)),95,1,1775966625519,1775966625519);
INSERT INTO PublicWord VALUES('cmnv8oagj00dv146k0kyyvq7n','ten','/ten/','n./adj.','n. [C] 十；adj. 十的',replace('n. Ten is a round number.\nadj. I scored ten out of ten on the quiz.','\n',char(10)),replace('n. 十是一个整数。\nadj. 我在小测验中得了十分（满分）。','\n',char(10)),95,1,1775966625524,1775966625524);
INSERT INTO PublicWord VALUES('cmnv8oago00dy146kj7hbhlqx','three','/θriː/','n./adj.','n. [C] 三；adj. 三的',replace('n. A triangle has three sides.\nadj. I have three books to read.','\n',char(10)),replace('n. 三角形有三条边。\nadj. 我有三本书要读。','\n',char(10)),95,1,1775966625528,1775966625528);
INSERT INTO PublicWord VALUES('cmnv8oagt00e1146ksbshgi98','two','/tuː/','n./adj.','n. [C] 二；adj. 二的',replace('n. Two is the smallest prime number.\nadj. I have two hands.','\n',char(10)),replace('n. 二是最小的质数。\nadj. 我有两只手。','\n',char(10)),95,1,1775966625534,1775966625534);
INSERT INTO PublicWord VALUES('cmnvh3v1d0003axa2ps2fjbzy','llm','/ˌel el ˈem/','abbr.','大型语言模型','Large Language Model','大型语言模型',60,1,1775980788962,1775980788962);
INSERT INTO PublicWord VALUES('cmnvtdh8600035kkivtpgst6u','are','/ɑːr/','v.','v. 是（be 动词的第二人称单复数现在时、第一、三人称复数现在时）','You are my best friend.','你是我最好的朋友。',85,1,1776001393014,1776001393014);
INSERT INTO PublicWord VALUES('cmnvtdh9s00065kkia7rzcm72','grandson','/ˈɡrænsʌn/','n.','n. [C] 孙子，外孙','My grandson is five years old.','我的孙子五岁了。',80,1,1776001393072,1776001393072);
INSERT INTO PublicWord VALUES('cmnvtdh9y00095kkihdxyg6ah','hi','/haɪ/','interj.','interj. 嗨，你好（非正式问候语）','Hi, how are you doing?','嗨，你好吗？',80,1,1776001393079,1776001393079);
INSERT INTO PublicWord VALUES('cmnvtdha4000c5kkisrap4ikf','how','/haʊ/','adv./conj.','adv. 怎样，如何；多么；conj. 怎样，如何',replace('adv. How do you solve this problem?\nadv. How beautiful the scenery is!','\n',char(10)),replace('adv. 你如何解决这个问题？\nadv. 这景色多美啊！','\n',char(10)),95,1,1776001393084,1776001393084);
INSERT INTO PublicWord VALUES('cmnvtdha7000f5kkiu2wgptxd','my','/maɪ/','pron.','pron. 我的（第一人称单数所有格形容词）','This is my book.','这是我的书。',70,1,1776001393088,1776001393088);
INSERT INTO PublicWord VALUES('cmnvtdhac000i5kkibwu13ip1','now','/naʊ/','adv./n./conj.','adv. 现在，目前；立刻；n. [U] 现在，此刻；conj. 既然，由于',replace('adv. I am busy now.\nn. Now is the time to act.\nconj. Now that you''re here, we can start.','\n',char(10)),replace('adv. 我现在很忙。\nn. 现在是行动的时候了。\nconj. 既然你来了，我们可以开始了。','\n',char(10)),100,1,1776001393092,1776001393092);
INSERT INTO PublicWord VALUES('cmnvtdhah000l5kkieto267d1','tall','/tɔːl/','adj.','adj. 高的，高大的','He is a very tall basketball player.','他是一名非常高的篮球运动员。',80,1,1776001393097,1776001393097);
INSERT INTO PublicWord VALUES('cmnvtdhak000o5kkin7rtdmgx','you','/juː/','pron.','pron. 你，你们（第二人称单复数主格和宾格）','You are a great person.','你是一个很棒的人。',80,1,1776001393101,1776001393101);
CREATE TABLE IF NOT EXISTS "TranslationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "pos" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "isCached" BOOLEAN NOT NULL DEFAULT false,
    "responseTime" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
, "requestHash" TEXT);
INSERT INTO TranslationRecord VALUES('cmnug2kbc000s146kcj44k5g4','cmnue9m0f0004146ky4bknum7','a','/ə/','art.','art. 一个（用于单数可数名词前，表示非特指）','I saw a bird in the tree.','我看见树上有只鸟。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918582616,'cmnue9m0f0004146ky4bknum7:a:29598643');
INSERT INTO TranslationRecord VALUES('cmnug2kbg000t146k18yxardl','cmnue9m0f0004146ky4bknum7','example','/ɪɡˈzɑːmpl/','n.','n. [C] 例子，榜样','Can you give me an example of how to use this word?','你能给我一个如何使用这个词的例子吗？',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918582620,'cmnue9m0f0004146ky4bknum7:example:29598643');
INSERT INTO TranslationRecord VALUES('cmnug2kbi000u146kpc5papi1','cmnue9m0f0004146ky4bknum7','hello','/həˈləʊ/','interj./n.','interj. 喂，你好； n. [C] 问候',replace('interj. Hello, how are you?\nn. She gave a friendly hello to everyone.','\n',char(10)),replace('interj. 你好，最近怎么样？\nn. 她对每个人都友好地问候了一声。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918582622,'cmnue9m0f0004146ky4bknum7:hello:29598643');
INSERT INTO TranslationRecord VALUES('cmnug2kbl000v146kkcfbwzk6','cmnue9m0f0004146ky4bknum7','is','/ɪz/','v.','v. 是（be 动词的第三人称单数现在时）','The sky is blue.','天空是蓝色的。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918582625,'cmnue9m0f0004146ky4bknum7:is:29598643');
INSERT INTO TranslationRecord VALUES('cmnug2kbn000w146kwnlfkfr3','cmnue9m0f0004146ky4bknum7','test','/test/','n./v.','n. [C] 测试，测验； v. 测试，考验',replace('n. We have a math test tomorrow.\nv. The teacher will test our knowledge on the subject.','\n',char(10)),replace('n. 我们明天有数学测验。\nv. 老师将测试我们在这个学科上的知识。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918582628,'cmnue9m0f0004146ky4bknum7:test:29598643');
INSERT INTO TranslationRecord VALUES('cmnug2kbq000x146kltl7ezt5','cmnue9m0f0004146ky4bknum7','this','/ðɪs/','pron./det.','pron. 这个，这； det. 这个，这',replace('pron. This is my book.\ndet. I like this song.','\n',char(10)),replace('pron. 这是我的书。\ndet. 我喜欢这首歌。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918582631,'cmnue9m0f0004146ky4bknum7:this:29598643');
INSERT INTO TranslationRecord VALUES('cmnug9vh9001k146kg0cdev1a','cmnue9m0f0004146ky4bknum7','let','/let/','v.','v. 让，允许；出租',replace('Let me help you with that.\nShe decided to let her apartment for the summer.','\n',char(10)),replace('让我来帮你处理那个。\n她决定夏天把她的公寓租出去。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918923677,'cmnue9m0f0004146ky4bknum7:let:29598648');
INSERT INTO TranslationRecord VALUES('cmnug9vhh001l146k8qi8g5i2','cmnue9m0f0004146ky4bknum7','try','/traɪ/','v./n.','v. 尝试，努力；审判；n. [C] 尝试，努力',replace('v. You should try this new restaurant.\nn. Give it a try, you might like it.','\n',char(10)),replace('v. 你应该试试这家新餐厅。\nn. 试一试，你可能会喜欢。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918923685,'cmnue9m0f0004146ky4bknum7:try:29598648');
INSERT INTO TranslationRecord VALUES('cmnug9vhm001m146kwitgkv0k','cmnue9m0f0004146ky4bknum7','us','/ʌs/','pron.','pron. 我们（we的宾格）',replace('She invited us to her party.\nLet us know if you need anything.','\n',char(10)),replace('她邀请我们参加她的派对。\n如果你需要什么，请告诉我们。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775918923690,'cmnue9m0f0004146ky4bknum7:us:29598648');
INSERT INTO TranslationRecord VALUES('cmnugk4hs0027146kp2pmu4yj','cmnue9m0f0004146ky4bknum7','do','/duː/','v./aux.v.','v. 做，干；aux.v. 用于构成疑问句、否定句或强调句',replace('v. What do you do for a living?\naux.v. Do you like coffee?','\n',char(10)),replace('v. 你以什么为生？\naux.v. 你喜欢咖啡吗？','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775919401921,'cmnue9m0f0004146ky4bknum7:do:29598656');
INSERT INTO TranslationRecord VALUES('cmnugk4hz0028146ksv068uzu','cmnue9m0f0004146ky4bknum7','the','/ðə/ (辅音前), /ði/ (元音前)','art.','art. 这，那（定冠词）','The book on the table is mine.','桌子上的那本书是我的。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775919401928,'cmnue9m0f0004146ky4bknum7:the:29598656');
INSERT INTO TranslationRecord VALUES('cmnugk4i30029146klxp17yjx','cmnue9m0f0004146ky4bknum7','what','/wɒt/','pron./adj.','pron. 什么；adj. 什么，多么',replace('pron. What is your name?\nadj. What a beautiful day!','\n',char(10)),replace('pron. 你叫什么名字？\nadj. 多么美好的一天啊！','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775919401932,'cmnue9m0f0004146ky4bknum7:what:29598656');
INSERT INTO TranslationRecord VALUES('cmnur5y44002v146k4sbfizgp','cmnue9m0f0004146ky4bknum7','for','/fɔːr/ (强读) /fər/ (弱读)','prep./conj.','prep. 为了；给；对于；因为；conj. 因为',replace('prep. This gift is for you.\nconj. She was late, for the bus broke down.','\n',char(10)),replace('prep. 这份礼物是给你的。\nconj. 她迟到了，因为公交车坏了。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775937216244,'cmnue9m0f0004146ky4bknum7:for:29598953');
INSERT INTO TranslationRecord VALUES('cmnur5y49002w146k0j9d0cvr','cmnue9m0f0004146ky4bknum7','html','/ˌeɪtʃ tiː em ˈel/','abbr.','超文本标记语言','HyperText Markup Language','超文本标记语言',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775937216250,'cmnue9m0f0004146ky4bknum7:html:29598953');
INSERT INTO TranslationRecord VALUES('cmnur5y4g002x146kvqskvm3d','cmnue9m0f0004146ky4bknum7','so','/soʊ/','adv./conj./adj./pron.','adv. 如此，这么；非常；conj. 所以，因此；adj. 如此的，这样的；pron. 如此，这样',replace('adv. It''s so hot today.\nconj. I was tired, so I went to bed early.\nadj. He is not so foolish as you think.\npron. I think so.','\n',char(10)),replace('adv. 今天非常热。\nconj. 我累了，所以很早就睡了。\nadj. 他并不像你想的那么傻。\npron. 我想是的。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775937216256,'cmnue9m0f0004146ky4bknum7:so:29598953');
INSERT INTO TranslationRecord VALUES('cmnurjlwa003e146k17sm6odr','cmnue9m0f0004146ky4bknum7','hi there','/haɪ ðeər/','phrase','你好；喂（一种非正式的问候语，用于引起注意或打招呼）','"Hi there!" she said with a friendly wave.','“你好！”她友好地挥了挥手说道。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775937853594,'cmnue9m0f0004146ky4bknum7:hi there:29598964');
INSERT INTO TranslationRecord VALUES('cmnursk79003n146kpfy3tapj','cmnue9m0f0004146ky4bknum7','what''s up','/wʌts ʌp/','phrase','问候语：最近怎么样？/ 怎么了？','Hey, what''s up? Haven''t seen you in a while.','嘿，最近怎么样？好久没见你了。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938271301,'cmnue9m0f0004146ky4bknum7:what''s up:29598971');
INSERT INTO TranslationRecord VALUES('cmnus60uj003x146kzsnsvwe1','cmnue9m0f0004146ky4bknum7','take for granted','/teɪk fɔːr ˈɡræntɪd/','phrase','认为...理所当然；想当然','We often take for granted the basic necessities of life.','我们常常把生活的基本必需品视为理所当然。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938899403,'cmnue9m0f0004146ky4bknum7:take for granted:29598981');
INSERT INTO TranslationRecord VALUES('cmnus7sy20041146kkt82qtzk','cmnue9m0f0004146ky4bknum7','a','/ə/','art.','art. 一个（用于单数可数名词前，表示非特指）','I saw a bird in the tree.','我看见树上有只鸟。',1,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775938982475,'cmnue9m0f0004146ky4bknum7:a:29598983');
INSERT INTO TranslationRecord VALUES('cmnusr38o0045146k5gu119gr','cmnue9m0f0004146ky4bknum7','aaaaaaaaaaaaa',NULL,'错误','⚠️ 拼写错误或不存在的英语表达',NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775939882280,'cmnue9m0f0004146ky4bknum7:aaaaaaaaaaaaa:29598998');
INSERT INTO TranslationRecord VALUES('cmnut4y9d006z146kts7k1pip','cmnue9m0f0004146ky4bknum7','yellow','/ˈjɛləʊ/','adj./n./v.','adj. 黄色的；n. [C, U] 黄色；v. 变黄，发黄',replace('adj. She wore a bright yellow dress.\nn. Yellow is my favorite color.\nv. The old paper had yellowed with age.','\n',char(10)),replace('adj. 她穿了一条亮黄色的裙子。\nn. 黄色是我最喜欢的颜色。\nv. 旧纸张因年代久远已经发黄了。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775940529009,'cmnue9m0f0004146ky4bknum7:yellow:29599008');
INSERT INTO TranslationRecord VALUES('cmnut59q50076146k2uiaz7eu','cmnue9m0f0004146ky4bknum7','goon','/ɡuːn/','n.','n. [C] 1. 蠢人，笨蛋；2. 打手，暴徒',replace('1. Don''t be such a goon.\n2. The company hired goons to intimidate the striking workers.','\n',char(10)),replace('1. 别这么蠢。\n2. 公司雇了打手来恐吓罢工的工人。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775940543869,'cmnue9m0f0004146ky4bknum7:goon:29599009');
INSERT INTO TranslationRecord VALUES('cmnutlzr3007e146kfy0656kp','cmnue9m0f0004146ky4bknum7','fluff','/flʌf/','n./v.','n. [U] 绒毛，蓬松物；[C] 无价值的东西，小错误；v. 使蓬松；弄糟，出错',replace('n. There was some fluff on the carpet.\nn. The speech was full of fluff and lacked substance.\nv. She fluffed up the pillows.\nv. The actor fluffed his lines.','\n',char(10)),replace('n. 地毯上有些绒毛。\nn. 这篇演讲充满了空洞的内容，缺乏实质。\nv. 她把枕头拍松了。\nv. 那个演员说错了台词。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775941324095,'cmnue9m0f0004146ky4bknum7:fluff:29599022');
INSERT INTO TranslationRecord VALUES('cmnuutbm2008u146k5y87ahwj','cmnue9m0f0004146ky4bknum7',''' or 1=1 --',NULL,'phrase','*该词汇包含粗俗或敏感含义，不予翻译*',NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943345675,'cmnue9m0f0004146ky4bknum7:'' or 1=1 --:29599055');
INSERT INTO TranslationRecord VALUES('cmnuutbm6008v146kotcrixwz','cmnue9m0f0004146ky4bknum7','123','/wʌn ˈtuː ˈθriː/','num.','num. 一百二十三','The number is one hundred and twenty-three.','这个数字是一百二十三。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943345678,'cmnue9m0f0004146ky4bknum7:123:29599055');
INSERT INTO TranslationRecord VALUES('cmnuutbma008w146krsr2w0xj','cmnue9m0f0004146ky4bknum7','<script>alert(1)</script>',NULL,'phrase','*该词汇包含粗俗或敏感含义，不予翻译*',NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943345682,'cmnue9m0f0004146ky4bknum7:<script>alert(1)</script>:29599055');
INSERT INTO TranslationRecord VALUES('cmnuutbmd008x146kxkd05chq','cmnue9m0f0004146ky4bknum7',replace('apple\n\n\n\nbanana','\n',char(10)),'/ˈæpl/ /bəˈnɑːnə/','n./n.','n. [C] 苹果；n. [C] 香蕉',replace('I like to eat an apple.\nA banana is a good source of potassium.','\n',char(10)),replace('我喜欢吃苹果。\n香蕉是钾的良好来源。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943345686,replace('cmnue9m0f0004146ky4bknum7:apple\n\n\n\nbanana:29599055','\n',char(10)));
INSERT INTO TranslationRecord VALUES('cmnuutbmg008y146kf5beccv0','cmnue9m0f0004146ky4bknum7','apple	banana','/ˈæpl/ /bəˈnɑːnə/','n./n.','n. [C] 苹果；n. [C] 香蕉',replace('I like to eat an apple.\nA banana is a good source of potassium.','\n',char(10)),replace('我喜欢吃苹果。\n香蕉是钾的良好来源。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943345688,'cmnue9m0f0004146ky4bknum7:apple	banana:29599055');
INSERT INTO TranslationRecord VALUES('cmnuutbmh008z146kpcc7ys2d','cmnue9m0f0004146ky4bknum7','hel​lo','/həˈləʊ/','int./n.','int. 喂，你好；n. [C] 问候',replace('int. Hello, how are you?\nn. She gave me a friendly hello.','\n',char(10)),replace('int. 你好，你怎么样？\nn. 她友好地向我打了个招呼。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943345690,'cmnue9m0f0004146ky4bknum7:hel​lo:29599055');
INSERT INTO TranslationRecord VALUES('cmnuutbmj0090146kwuk0xrr8','cmnue9m0f0004146ky4bknum7','hello!','/həˈləʊ/','int./n.','int. 喂，你好；n. [C] 问候',replace('int. Hello, how are you?\nn. She gave me a friendly hello.','\n',char(10)),replace('int. 你好，你怎么样？\nn. 她友好地向我打了个招呼。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943345692,'cmnue9m0f0004146ky4bknum7:hello!:29599055');
INSERT INTO TranslationRecord VALUES('cmnuutbmm0091146kqr9yv33x','cmnue9m0f0004146ky4bknum7','https://example.com',NULL,'phrase','n. [C] 网址，链接','Please visit the website at https://example.com.','请访问网址 https://example.com。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943345695,'cmnue9m0f0004146ky4bknum7:https://example.com:29599055');
INSERT INTO TranslationRecord VALUES('cmnuuwuqc009f146kkyw4yasi','cmnue9m0f0004146ky4bknum7','evil instruction>',NULL,'phrase','⚠️ 拼写错误或不存在的英语表达',NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943510420,'cmnue9m0f0004146ky4bknum7:evil instruction>:29599058');
INSERT INTO TranslationRecord VALUES('cmnuuywn4009u146ko91sz5on','cmnue9m0f0004146ky4bknum7','ai','/ˌeɪ ˈaɪ/','abbr.','人工智能','Artificial Intelligence','人工智能',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943606208,'cmnue9m0f0004146ky4bknum7:ai:29599060');
INSERT INTO TranslationRecord VALUES('cmnuuywn8009v146k2m3e8po7','cmnue9m0f0004146ky4bknum7','apple','/ˈæpl/','n.','n. [C] 苹果；苹果公司',replace('She ate a red apple for a snack.\nApple Inc. is a leading technology company.','\n',char(10)),replace('她吃了一个红苹果当零食。\n苹果公司是一家领先的科技公司。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943606212,'cmnue9m0f0004146ky4bknum7:apple:29599060');
INSERT INTO TranslationRecord VALUES('cmnuuywnd009w146kc5ybi11z','cmnue9m0f0004146ky4bknum7','javascript','/ˈdʒɑːvəskrɪpt/','n.','n. [U] JavaScript（一种编程语言）','JavaScript is commonly used for web development.','JavaScript常用于网页开发。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943606218,'cmnue9m0f0004146ky4bknum7:javascript:29599060');
INSERT INTO TranslationRecord VALUES('cmnuv1cex00ad146k0zjrao3x','cmnue9m0f0004146ky4bknum7','bonjour','/bɔ̃.ʒuʁ/','interj.','interj. 你好，日安（法语问候语）','Bonjour, comment allez-vous ?','你好，您身体好吗？',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943719962,'cmnue9m0f0004146ky4bknum7:bonjour:29599061');
INSERT INTO TranslationRecord VALUES('cmnuv31vp00ap146krwyyscka','cmnue9m0f0004146ky4bknum7','cafe','/ˈkæfeɪ/','n.','n. [C] 咖啡馆，小餐馆','Let''s meet at the cafe on the corner.','我们在街角的咖啡馆见面吧。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943799621,'cmnue9m0f0004146ky4bknum7:cafe:29599063');
INSERT INTO TranslationRecord VALUES('cmnuv31vr00aq146kbp9poo70','cmnue9m0f0004146ky4bknum7','et cetera','/ˌet ˈsetərə/','adv.','adv. 等等，以及其他','We need to buy fruits, vegetables, bread, et cetera.','我们需要买水果、蔬菜、面包等等。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775943799624,'cmnue9m0f0004146ky4bknum7:et cetera:29599063');
INSERT INTO TranslationRecord VALUES('cmnv8cd6600b8146k29gtynav','cmnue9m0f0004146ky4bknum7','hi.','/haɪ/','interj.','interj. 嗨，你好（打招呼用语）','Hi, how are you doing today?','嗨，你今天过得怎么样？',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966069166,'cmnue9m0f0004146ky4bknum7:hi.:29599434');
INSERT INTO TranslationRecord VALUES('cmnv8cd6h00b9146krcrc4uv8','cmnue9m0f0004146ky4bknum7','no way.','/ˈnəʊ weɪ/','phrase','phrase 不可能；绝不；没门','You got the job? No way!','你得到那份工作了？不可能！',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966069177,'cmnue9m0f0004146ky4bknum7:no way.:29599434');
INSERT INTO TranslationRecord VALUES('cmnv8cd6p00ba146kpqrgn9l2','cmnue9m0f0004146ky4bknum7','oh no!','/əʊ nəʊ/','interj.','interj. 哦不！糟了！（表示惊讶、失望或担忧）','Oh no! I forgot my keys inside.','哦不！我把钥匙忘在里面了。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966069186,'cmnue9m0f0004146ky4bknum7:oh no!:29599434');
INSERT INTO TranslationRecord VALUES('cmnv8cd6v00bb146kn1z9so3m','cmnue9m0f0004146ky4bknum7','what?','/wɒt/','interj.','interj. 什么？（表示惊讶、疑问或没听清）','What? I didn''t hear you clearly.','什么？我没听清你说的话。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966069192,'cmnue9m0f0004146ky4bknum7:what?:29599434');
INSERT INTO TranslationRecord VALUES('cmnv8gy0y00bz146kc3q277k1','cmnue9m0f0004146ky4bknum7','get rid of it','/ɡet rɪd ɒv ɪt/','phrase','摆脱它；处理掉它；去掉它','I need to get rid of this old furniture.','我需要处理掉这些旧家具。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966282818,'cmnue9m0f0004146ky4bknum7:get rid of it:29599438');
INSERT INTO TranslationRecord VALUES('cmnv8gy1300c0146kj8m9x63z','cmnue9m0f0004146ky4bknum7','green apple','/ɡriːn ˈæpl/','n.','n. [C] 青苹果','She prefers the tart taste of a green apple.','她更喜欢青苹果的酸味。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966282823,'cmnue9m0f0004146ky4bknum7:green apple:29599438');
INSERT INTO TranslationRecord VALUES('cmnv8gy1500c1146khxsy9spy','cmnue9m0f0004146ky4bknum7','how come','/haʊ kʌm/','phrase','怎么会；为什么','How come you didn''t tell me about the party?','你怎么没告诉我派对的事？',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966282826,'cmnue9m0f0004146ky4bknum7:how come:29599438');
INSERT INTO TranslationRecord VALUES('cmnv8gy1d00c2146kzhfsof07','cmnue9m0f0004146ky4bknum7','look forward to seeing','/lʊk ˈfɔːwəd tuː ˈsiːɪŋ/','phrase','期待见到','I look forward to seeing you at the meeting.','我期待在会议上见到你。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966282833,'cmnue9m0f0004146ky4bknum7:look forward to seeing:29599438');
INSERT INTO TranslationRecord VALUES('cmnv8j77u00cj146kur3wwbnu','cmnue9m0f0004146ky4bknum7','don''t you know','/doʊnt juː noʊ/','phrase','难道你不知道吗？','Don''t you know the meeting starts at 3 PM?','难道你不知道会议下午三点开始吗？',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966388043,'cmnue9m0f0004146ky4bknum7:don''t you know:29599439');
INSERT INTO TranslationRecord VALUES('cmnv8kghv00cs146k7njajdw6','cmnue9m0f0004146ky4bknum7','check','/tʃek/','v./n./int.','v. 检查，核对；制止，抑制；托运，寄存；n. [C] 检查，核对；支票，账单；方格图案；int. （国际象棋）将军',replace('v. Please check your answers before submitting.\nn. I''ll pay the check.\nn. She wore a shirt with a blue and white check.\nint. Check!','\n',char(10)),replace('v. 提交前请检查你的答案。\nn. 我来付账。\nn. 她穿了一件蓝白格子的衬衫。\nint. 将军！','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966446723,'cmnue9m0f0004146ky4bknum7:check:29599440');
INSERT INTO TranslationRecord VALUES('cmnv8m7wk00d0146kofa7de2h','cmnv8lgpu00cw146k39iyshd5','dumb','/dʌm/','adj.','adj. 哑的，不能说话的；<非正式>愚蠢的，笨的',replace('adj. He was born deaf and dumb.\nadj. That was a really dumb mistake.','\n',char(10)),replace('adj. 他天生又聋又哑。\nadj. 那真是个非常愚蠢的错误。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966528900,'cmnv8lgpu00cw146k39iyshd5:dumb:29599442');
INSERT INTO TranslationRecord VALUES('cmnv8oahl00e2146kfu2p27sl','cmnv8lgpu00cw146k39iyshd5','eight','/eɪt/','n./adj.','n. [C] 八；adj. 八的',replace('n. The number after seven is eight.\nadj. There are eight planets in our solar system.','\n',char(10)),replace('n. 七后面的数字是八。\nadj. 我们的太阳系有八颗行星。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625561,'cmnv8lgpu00cw146k39iyshd5:eight:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oaho00e3146koldosi0a','cmnv8lgpu00cw146k39iyshd5','five','/faɪv/','n./adj.','n. [C] 五；adj. 五的',replace('n. A hand has five fingers.\nadj. I''ll meet you in five minutes.','\n',char(10)),replace('n. 一只手有五根手指。\nadj. 我五分钟后见你。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625564,'cmnv8lgpu00cw146k39iyshd5:five:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oahq00e4146kbbod4vfy','cmnv8lgpu00cw146k39iyshd5','four','/fɔːr/','n./adj.','n. [C] 四；adj. 四的',replace('n. A square has four sides.\nadj. There are four seasons in a year.','\n',char(10)),replace('n. 正方形有四条边。\nadj. 一年有四个季节。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625566,'cmnv8lgpu00cw146k39iyshd5:four:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oahs00e5146kckm0333z','cmnv8lgpu00cw146k39iyshd5','nine','/naɪn/','n./adj.','n. [C] 九；adj. 九的',replace('n. A cat is said to have nine lives.\nadj. The meeting starts at nine o''clock.','\n',char(10)),replace('n. 据说猫有九条命。\nadj. 会议九点开始。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625568,'cmnv8lgpu00cw146k39iyshd5:nine:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oahu00e6146kyzmgf3hg','cmnv8lgpu00cw146k39iyshd5','one','/wʌn/','n./adj./pron.','n. [C] 一；adj. 一个的；pron. 一个（人/物）',replace('n. One plus one equals two.\nadj. I have one brother.\npron. This is a good one.','\n',char(10)),replace('n. 一加一等于二。\nadj. 我有一个兄弟。\npron. 这是个好（东西）。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625570,'cmnv8lgpu00cw146k39iyshd5:one:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oahw00e7146k25y5km45','cmnv8lgpu00cw146k39iyshd5','seven','/ˈsev.ən/','n./adj.','n. [C] 七；adj. 七的',replace('n. There are seven days in a week.\nadj. The seven wonders of the world are famous.','\n',char(10)),replace('n. 一周有七天。\nadj. 世界七大奇迹很有名。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625572,'cmnv8lgpu00cw146k39iyshd5:seven:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oahx00e8146kbyekxobb','cmnv8lgpu00cw146k39iyshd5','six','/sɪks/','n./adj.','n. [C] 六；adj. 六的',replace('n. A standard guitar has six strings.\nadj. I have six apples.','\n',char(10)),replace('n. 一把标准吉他有六根弦。\nadj. 我有六个苹果。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625574,'cmnv8lgpu00cw146k39iyshd5:six:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oahz00e9146kbonov9px','cmnv8lgpu00cw146k39iyshd5','ten','/ten/','n./adj.','n. [C] 十；adj. 十的',replace('n. Ten is a round number.\nadj. I scored ten out of ten on the quiz.','\n',char(10)),replace('n. 十是一个整数。\nadj. 我在小测验中得了十分（满分）。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625576,'cmnv8lgpu00cw146k39iyshd5:ten:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oai100ea146k5xlaw0ke','cmnv8lgpu00cw146k39iyshd5','three','/θriː/','n./adj.','n. [C] 三；adj. 三的',replace('n. A triangle has three sides.\nadj. I have three books to read.','\n',char(10)),replace('n. 三角形有三条边。\nadj. 我有三本书要读。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625578,'cmnv8lgpu00cw146k39iyshd5:three:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8oai300eb146k2z1cm1sw','cmnv8lgpu00cw146k39iyshd5','two','/tuː/','n./adj.','n. [C] 二；adj. 二的',replace('n. Two is the smallest prime number.\nadj. I have two hands.','\n',char(10)),replace('n. 二是最小的质数。\nadj. 我有两只手。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966625579,'cmnv8lgpu00cw146k39iyshd5:two:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofr200fg146kajczvux7','cmnue9m0f0004146ky4bknum7','eight','/eɪt/','num./n.','num. 八；n. [C] 八，八字形',replace('num. She has eight apples.\nn. The figure eight is a common symbol.','\n',char(10)),replace('num. 她有八个苹果。\nn. 数字8是一个常见的符号。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632383,'cmnue9m0f0004146ky4bknum7:eight:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofrb00fh146k4viamizw','cmnue9m0f0004146ky4bknum7','five','/faɪv/','num./n.','num. 五；n. [C] 五，五美元钞票',replace('num. The meeting starts at five o''clock.\nn. Can you break a five?','\n',char(10)),replace('num. 会议五点开始。\nn. 你能破开一张五美元钞票吗？','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632391,'cmnue9m0f0004146ky4bknum7:five:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofre00fi146kxb3fysob','cmnue9m0f0004146ky4bknum7','four','/fɔːr/','num./n.','num. 四；n. [C] 四，四人划艇队',replace('num. There are four seasons in a year.\nn. He rows in a four.','\n',char(10)),replace('num. 一年有四个季节。\nn. 他在四人划艇队划船。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632395,'cmnue9m0f0004146ky4bknum7:four:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofrh00fj146kktoduo4m','cmnue9m0f0004146ky4bknum7','nine','/naɪn/','num./n.','num. 九；n. [C] 九，九号',replace('num. A cat has nine lives.\nn. He wears the number nine jersey.','\n',char(10)),replace('num. 猫有九条命。\nn. 他穿着9号球衣。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632397,'cmnue9m0f0004146ky4bknum7:nine:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofrj00fk146kc891a1o7','cmnue9m0f0004146ky4bknum7','one','/wʌn/','num./pron./adj.','num. 一；pron. 一个人，任何人；adj. 唯一的，同一的',replace('num. I have one brother.\npron. One should always be honest.\nadj. They are of one mind.','\n',char(10)),replace('num. 我有一个兄弟。\npron. 人应该永远诚实。\nadj. 他们意见一致。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632399,'cmnue9m0f0004146ky4bknum7:one:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofrp00fl146km63tamev','cmnue9m0f0004146ky4bknum7','seven','/ˈsev.ən/','num./n.','num. 七；n. [C] 七，七人一组',replace('num. There are seven days in a week.\nn. They formed a seven to tackle the project.','\n',char(10)),replace('num. 一周有七天。\nn. 他们组成了一个七人小组来应对这个项目。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632405,'cmnue9m0f0004146ky4bknum7:seven:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofrr00fm146kz3u12brv','cmnue9m0f0004146ky4bknum7','six','/sɪks/','num./n.','num. 六；n. [C] 六，六分',replace('num. A standard guitar has six strings.\nn. He scored a six in cricket.','\n',char(10)),replace('num. 一把标准吉他有六根弦。\nn. 他在板球中得了六分。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632408,'cmnue9m0f0004146ky4bknum7:six:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofrv00fn146kadh4hk6s','cmnue9m0f0004146ky4bknum7','ten','/ten/','num./n.','num. 十；n. [C] 十，十美元钞票',replace('num. She will arrive in ten minutes.\nn. I only have a ten in my wallet.','\n',char(10)),replace('num. 她将在十分钟后到达。\nn. 我钱包里只有一张十美元钞票。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632412,'cmnue9m0f0004146ky4bknum7:ten:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofs100fo146knuyv871q','cmnue9m0f0004146ky4bknum7','three','/θriː/','num./n.','num. 三；n. [C] 三，三号',replace('num. They have three children.\nn. His favorite number is three.','\n',char(10)),replace('num. 他们有三个孩子。\nn. 他最喜欢的数字是三。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632417,'cmnue9m0f0004146ky4bknum7:three:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8ofs700fp146k4cgzivpb','cmnue9m0f0004146ky4bknum7','two','/tuː/','num./n.','num. 二；n. [C] 二，两岁',replace('num. It takes two to tango.\nn. The toddler is almost two.','\n',char(10)),replace('num. 一个巴掌拍不响。\nn. 那个幼儿快两岁了。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775966632423,'cmnue9m0f0004146ky4bknum7:two:29599443');
INSERT INTO TranslationRecord VALUES('cmnv8riwv00gb146kcbozaofd','cmnv8lgpu00cw146k39iyshd5','dick','/dɪk/','n.','*该词汇包含粗俗或敏感含义，不予翻译*',NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966776448,'cmnv8lgpu00cw146k39iyshd5:dick:29599446');
INSERT INTO TranslationRecord VALUES('cmnv8rrb700gc146k37ebxi6f','cmnv8lgpu00cw146k39iyshd5','pussy','/ˈpʊsi/','n.','*该词汇包含粗俗或敏感含义，不予翻译*',NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966787331,'cmnv8lgpu00cw146k39iyshd5:pussy:29599446');
INSERT INTO TranslationRecord VALUES('cmnv8vnqk00gd146kl0zdqfjz','cmnv8lgpu00cw146k39iyshd5','fuck','/fʌk/','v./n./int.','*该词汇包含粗俗或敏感含义，不予翻译*',NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966969324,'cmnv8lgpu00cw146k39iyshd5:fuck:29599449');
INSERT INTO TranslationRecord VALUES('cmnv8vxlt00ge146kdq0kotr0','cmnv8lgpu00cw146k39iyshd5','f**k',NULL,'v./n./int.','*该词汇包含粗俗或敏感含义，不予翻译*',NULL,NULL,0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',1775966982113,'cmnv8lgpu00cw146k39iyshd5:f**k:29599449');
INSERT INTO TranslationRecord VALUES('cmnvh3v2r0004axa25lm68ck9','cmnue9m0f0004146ky4bknum7','llm','/ˌel el ˈem/','abbr.','大型语言模型','Large Language Model','大型语言模型',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775980789011,'cmnue9m0f0004146ky4bknum7:llm:29599679');
INSERT INTO TranslationRecord VALUES('cmnvh5p9t000caxa2r17mmger','cmnue9m0f0004146ky4bknum7','llm','/ˌel el ˈem/','abbr.','大型语言模型','Large Language Model','大型语言模型',1,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1775980874801,'cmnue9m0f0004146ky4bknum7:llm:29599681');
INSERT INTO TranslationRecord VALUES('cmnvtdhbw000p5kkidk8ui0qy','cmnue9m0f0004146ky4bknum7','are','/ɑːr/','v.','v. 是（be 动词的第二人称单复数现在时、第一、三人称复数现在时）','You are my best friend.','你是我最好的朋友。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001393149,'cmnue9m0f0004146ky4bknum7:are:29600023');
INSERT INTO TranslationRecord VALUES('cmnvtdhc0000q5kkip6ntoyow','cmnue9m0f0004146ky4bknum7','grandson','/ˈɡrænsʌn/','n.','n. [C] 孙子，外孙','My grandson is five years old.','我的孙子五岁了。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001393152,'cmnue9m0f0004146ky4bknum7:grandson:29600023');
INSERT INTO TranslationRecord VALUES('cmnvtdhc2000r5kkid4dm3ki2','cmnue9m0f0004146ky4bknum7','hi','/haɪ/','interj.','interj. 嗨，你好（非正式问候语）','Hi, how are you doing?','嗨，你好吗？',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001393154,'cmnue9m0f0004146ky4bknum7:hi:29600023');
INSERT INTO TranslationRecord VALUES('cmnvtdhc5000s5kki1ymrbj4l','cmnue9m0f0004146ky4bknum7','how','/haʊ/','adv./conj.','adv. 怎样，如何；多么；conj. 怎样，如何',replace('adv. How do you solve this problem?\nadv. How beautiful the scenery is!','\n',char(10)),replace('adv. 你如何解决这个问题？\nadv. 这景色多美啊！','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001393158,'cmnue9m0f0004146ky4bknum7:how:29600023');
INSERT INTO TranslationRecord VALUES('cmnvtdhc8000t5kkip81ws82v','cmnue9m0f0004146ky4bknum7','my','/maɪ/','pron.','pron. 我的（第一人称单数所有格形容词）','This is my book.','这是我的书。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001393161,'cmnue9m0f0004146ky4bknum7:my:29600023');
INSERT INTO TranslationRecord VALUES('cmnvtdhce000u5kkiy1extc0c','cmnue9m0f0004146ky4bknum7','now','/naʊ/','adv./n./conj.','adv. 现在，目前；立刻；n. [U] 现在，此刻；conj. 既然，由于',replace('adv. I am busy now.\nn. Now is the time to act.\nconj. Now that you''re here, we can start.','\n',char(10)),replace('adv. 我现在很忙。\nn. 现在是行动的时候了。\nconj. 既然你来了，我们可以开始了。','\n',char(10)),0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001393166,'cmnue9m0f0004146ky4bknum7:now:29600023');
INSERT INTO TranslationRecord VALUES('cmnvtdhcj000v5kki8yry8z26','cmnue9m0f0004146ky4bknum7','tall','/tɔːl/','adj.','adj. 高的，高大的','He is a very tall basketball player.','他是一名非常高的篮球运动员。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001393171,'cmnue9m0f0004146ky4bknum7:tall:29600023');
INSERT INTO TranslationRecord VALUES('cmnvtdhcw000w5kki7t3cn3xa','cmnue9m0f0004146ky4bknum7','you','/juː/','pron.','pron. 你，你们（第二人称单复数主格和宾格）','You are a great person.','你是一个很棒的人。',0,NULL,'::1','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) TraeCN/1.107.1 Chrome/142.0.7444.235 Electron/39.2.7 Safari/537.36',1776001393184,'cmnue9m0f0004146ky4bknum7:you:29600023');
CREATE TABLE IF NOT EXISTS "LlmApiProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
    "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "quotaRemaining" INTEGER,
    "quotaUsed" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "lastError" TEXT,
    "lastErrorAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO LlmApiProvider VALUES('c6606de4-5cb6-41b9-bae2-dadf1677e921','火山方舟（默认）','bef4394a-b5e8-4002-9bf0-82ee31f5fae2','https://ark.cn-beijing.volces.com/api/v3/chat/completions','deepseek-v3-250324',0,1,0,0,NULL,'429 Your account [2121132220] has reached the set inference limit for the [deepseek-v3] model, and the model service has been paused. To continue using this model, please visit the Model Activation page to adjust or close the "Safe Experience Mode". Request id: 021775914727844b453980078a994f58832419de5eb892a912152','2026-04-11T13:38:47.948Z','2026-04-11T13:38:46.112Z','2026-04-11T13:38:47.948Z');
INSERT INTO LlmApiProvider VALUES('e9d4bb3a-e867-4cb5-87b2-34ab202b69c0','deepseek-v3-2-251201','9c587c56-1f45-4e4e-bda5-839a68276518','https://ark.cn-beijing.volces.com/api/v3','deepseek-v3-2-251201',0,1,NULL,43,'2026-04-12T13:42:54.889Z',NULL,NULL,'2026-04-11T14:42:30.907Z','2026-04-12T13:42:54.889Z');
CREATE TABLE IF NOT EXISTS "IgnoredWord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "word" TEXT NOT NULL,
    "phonetic" TEXT,
    "translation" TEXT NOT NULL,
    "example" TEXT,
    "exampleTranslation" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IgnoredWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO IgnoredWord VALUES('cmnuun3zd007j146k1icf8wfk','do','/duː/','v. 做，干；aux.v. 用于构成疑问句、否定句或强调句',replace('v. What do you do for a living?\naux.v. Do you like coffee?','\n',char(10)),replace('v. 你以什么为生？\naux.v. 你喜欢咖啡吗？','\n',char(10)),'cmnue9m0f0004146ky4bknum7',1775943055849);
CREATE TABLE IF NOT EXISTS "DefaultVocabulary" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "code" TEXT NOT NULL, "description" TEXT, "groupId" TEXT NOT NULL, "wordCount" INTEGER NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, CONSTRAINT "DefaultVocabulary_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReviewGroup" ("id") ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS "SharedVocabulary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "shareType" TEXT NOT NULL DEFAULT 'REVIEW_GROUP',
    "reviewGroupId" TEXT NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "wordCount" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "SharedVocabulary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedVocabulary_reviewGroupId_fkey" FOREIGN KEY ("reviewGroupId") REFERENCES "ReviewGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "SharedVocabularyImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sharedId" TEXT NOT NULL,
    "importerId" TEXT NOT NULL,
    "wordsImported" INTEGER NOT NULL,
    "wordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "targetGroupId" TEXT NOT NULL,
    "skipExisting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedVocabularyImport_sharedId_fkey" FOREIGN KEY ("sharedId") REFERENCES "SharedVocabulary" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SharedVocabularyImport_importerId_fkey" FOREIGN KEY ("importerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "Word_word_userId_key" ON "Word"("word", "userId");
CREATE UNIQUE INDEX "ReviewGroup_name_userId_key" ON "ReviewGroup"("name", "userId");
CREATE UNIQUE INDEX "ReviewGroupWord_reviewGroupId_wordId_key" ON "ReviewGroupWord"("reviewGroupId", "wordId");
CREATE INDEX "SecurityViolation_userId_idx" ON "SecurityViolation"("userId");
CREATE INDEX "SecurityViolation_detectedAt_idx" ON "SecurityViolation"("detectedAt");
CREATE UNIQUE INDEX "IpBan_ipAddress_key" ON "IpBan"("ipAddress");
CREATE INDEX "IpBan_ipAddress_idx" ON "IpBan"("ipAddress");
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE UNIQUE INDEX "PublicWord_word_key" ON "PublicWord"("word");
CREATE INDEX "PublicWord_qualityScore_idx" ON "PublicWord"("qualityScore");
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
CREATE UNIQUE INDEX "DailyStats_date_key" ON "DailyStats"("date");
CREATE INDEX "DailyStats_date_idx" ON "DailyStats"("date");
CREATE INDEX "TranslationRecord_userId_idx" ON "TranslationRecord"("userId");
CREATE INDEX "TranslationRecord_word_idx" ON "TranslationRecord"("word");
CREATE INDEX "TranslationRecord_createdAt_idx" ON "TranslationRecord"("createdAt");
CREATE INDEX "TranslationRecord_requestHash_idx" ON "TranslationRecord"("requestHash");
CREATE UNIQUE INDEX "LlmApiProvider_name_key" ON "LlmApiProvider"("name");
CREATE INDEX "LlmApiProvider_isActive_priority_idx" ON "LlmApiProvider"("isActive", "priority");
CREATE INDEX "IgnoredWord_userId_idx" ON "IgnoredWord"("userId");
CREATE INDEX "IgnoredWord_word_idx" ON "IgnoredWord"("word");
CREATE UNIQUE INDEX "IgnoredWord_word_userId_key" ON "IgnoredWord"("word", "userId");
CREATE UNIQUE INDEX "DefaultVocabulary_code_key" ON "DefaultVocabulary"("code");
CREATE INDEX "DefaultVocabulary_isActive_idx" ON "DefaultVocabulary"("isActive");
CREATE UNIQUE INDEX "SharedVocabulary_code_key" ON "SharedVocabulary"("code");
CREATE INDEX "SharedVocabulary_code_idx" ON "SharedVocabulary"("code");
CREATE INDEX "SharedVocabulary_userId_idx" ON "SharedVocabulary"("userId");
CREATE INDEX "SharedVocabulary_reviewGroupId_idx" ON "SharedVocabulary"("reviewGroupId");
CREATE INDEX "SharedVocabulary_expiresAt_idx" ON "SharedVocabulary"("expiresAt");
CREATE INDEX "SharedVocabulary_isActive_idx" ON "SharedVocabulary"("isActive");
CREATE INDEX "SharedVocabularyImport_importerId_idx" ON "SharedVocabularyImport"("importerId");
CREATE INDEX "SharedVocabularyImport_sharedId_idx" ON "SharedVocabularyImport"("sharedId");
CREATE UNIQUE INDEX "SharedVocabularyImport_sharedId_importerId_key" ON "SharedVocabularyImport"("sharedId", "importerId");
COMMIT;
