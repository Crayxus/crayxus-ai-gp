// EI TOKEN 案例 · 开机表情脸
// 一开机就有一张会眨眼的脸，还会挨句跟你打招呼
// 适用：M5 StackChan（CoreS3）

#include <Arduino.h>
#include <M5StackChan.h>
#include <Avatar.h>

using namespace m5avatar;

Avatar avatar;  // 表情脸自己开一个任务画，不用在 loop 里刷

// 一轮打招呼：表情 + 说的话
struct Greeting_t {
  Expression exp;
  const char *words;
};

static const Greeting_t kGreetings[] = {
  {Expression::Happy,   "你好呀～"},
  {Expression::Neutral, "我是 StackChan"},
  {Expression::Doubt,   "今天写代码了吗"},
  {Expression::Happy,   "一起玩点好玩的"},
  {Expression::Sleepy,  "困了...再摸摸我"},
};
static const int kGreetingCount = sizeof(kGreetings) / sizeof(kGreetings[0]);

static int step = 0;

// 张嘴闭嘴几下，看着像在说话
void talk(uint32_t ms) {
  uint32_t end = millis() + ms;
  while (millis() < end) {
    avatar.setMouthOpenRatio(0.7f);
    delay(120);
    avatar.setMouthOpenRatio(0.0f);
    delay(120);
  }
}

void setup() {
  Serial.begin(115200);

  // 一句话把屏幕 / 触摸 / 舵机 / RGB 全初始化好
  M5StackChan.begin();

  // 这个案例只用脸，不动脖子，关掉舵机供电更安静也更省电
  M5StackChan.setServoPowerEnabled(false);
  M5StackChan.showRgbColor(0, 0, 0);

  avatar.setSpeechFont(&fonts::efontCN_16);  // 说话气泡要中文字库
  avatar.init();                             // 开始画脸
  avatar.setIsAutoBlink(true);               // 随机眨眼，活人感全靠它

  Serial.println("EIT sc-hello ready");
}

void loop() {
  M5StackChan.update();

  const Greeting_t &g = kGreetings[step];
  avatar.setExpression(g.exp);
  avatar.setSpeechText(g.words);
  Serial.printf("say: %s\n", g.words);

  talk(1200);
  delay(1500);

  step = (step + 1) % kGreetingCount;
}
