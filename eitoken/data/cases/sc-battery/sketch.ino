// EI TOKEN 案例 · 电量看板
// 机身上的 INA226 能同时读电压和电流，屏幕上做成一块仪表
// 适用：M5 StackChan（CoreS3）

#include <Arduino.h>
#include <M5StackChan.h>

// 单节锂电：满电 4.2V，空电按 3.30V 算
static const float kFullVoltage  = 4.20f;
static const float kEmptyVoltage = 3.30f;
static const float kLowPercent   = 20.0f;   // 低于这个数就报警

// 电压换个大概的百分比（够用就行，要准得做放电曲线标定）
float voltageToPercent(float v) {
  float p = (v - kEmptyVoltage) / (kFullVoltage - kEmptyVoltage) * 100.0f;
  if (p < 0) p = 0;
  if (p > 100) p = 100;
  return p;
}

// 画一根电量条
void drawBar(int x, int y, int w, int h, float percent, uint16_t color) {
  M5StackChan.Display().drawRoundRect(x, y, w, h, 4, TFT_DARKGREY);
  int inner = (int)((w - 6) * percent / 100.0f);
  M5StackChan.Display().fillRect(x + 3, y + 3, w - 6, h - 6, TFT_BLACK);
  if (inner > 0) {
    M5StackChan.Display().fillRect(x + 3, y + 3, inner, h - 6, color);
  }
}

void setup() {
  Serial.begin(115200);
  M5StackChan.begin();

  // 只看电，不动脖子
  M5StackChan.setServoPowerEnabled(false);

  M5StackChan.Display().fillScreen(TFT_BLACK);
  M5StackChan.Display().setTextSize(2);
  M5StackChan.Display().setTextColor(TFT_WHITE, TFT_BLACK);
  M5StackChan.Display().setCursor(10, 10);
  M5StackChan.Display().print("Battery");

  Serial.println("EIT sc-battery ready");
}

void loop() {
  M5StackChan.update();

  float voltage = M5StackChan.getBatteryVoltage();
  float current_ma = M5StackChan.getBatteryCurrent() * 1000.0f;  // 库里返回的是 A
  // 电流为正 = 正在放电，为负 = 正在充电
  bool charging = current_ma < -5.0f;
  float percent = voltageToPercent(voltage);
  bool low = (percent < kLowPercent) && !charging;

  uint16_t bar_color = charging ? TFT_GREEN : (low ? TFT_RED : TFT_CYAN);

  M5StackChan.Display().setTextSize(2);
  M5StackChan.Display().setCursor(10, 50);
  M5StackChan.Display().printf("%.2f V   ", voltage);
  M5StackChan.Display().setCursor(10, 80);
  M5StackChan.Display().printf("%+.0f mA    ", current_ma);
  M5StackChan.Display().setCursor(10, 110);
  M5StackChan.Display().setTextColor(bar_color, TFT_BLACK);
  M5StackChan.Display().printf("%-10s", charging ? "CHARGING" : (low ? "LOW!" : "DISCHARGE"));
  M5StackChan.Display().setTextColor(TFT_WHITE, TFT_BLACK);

  drawBar(10, 150, 300, 34, percent, bar_color);
  M5StackChan.Display().setCursor(10, 200);
  M5StackChan.Display().printf("%.0f %%   ", percent);

  // 灯当指示器：充电呼吸绿、低电闪红、平时不亮
  if (charging) {
    float k = (sinf(millis() / 600.0f) + 1.0f) / 2.0f;
    M5StackChan.showRgbColor(0, (uint8_t)(20 + k * 120), 0);
  } else if (low) {
    bool on = (millis() / 400) % 2 == 0;
    M5StackChan.showRgbColor(on ? 150 : 0, 0, 0);
  } else {
    M5StackChan.showRgbColor(0, 0, 0);
  }

  Serial.printf("bat %.2fV %.0fmA %.0f%% %s\n", voltage, current_ma, percent,
                charging ? "charging" : (low ? "low" : "ok"));

  delay(500);
}
