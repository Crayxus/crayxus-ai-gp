// EI TOKEN 案例 · 旋钮调光
// 拧电位器，灯的亮度跟着变
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int KNOB_PIN = 1;
const int LED_PIN = 18;
#elif defined(ESP32)
const int KNOB_PIN = 34;
const int LED_PIN = 26;
#else
const int KNOB_PIN = A0;
const int LED_PIN = 9;
#endif

#if defined(ESP32)
const int ADC_MAX = 4095;   // ESP32 的 ADC 是 12 位
#else
const int ADC_MAX = 1023;   // Uno/Nano 的 ADC 是 10 位
#endif

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("EIT knob-dimmer ready");
}

void loop() {
  int raw = analogRead(KNOB_PIN);
  int level = map(raw, 0, ADC_MAX, 0, 255);   // 读数换算成 0~255 的亮度
  analogWrite(LED_PIN, level);
  Serial.print("knob "); Serial.print(raw); Serial.print(" -> "); Serial.println(level);
  delay(100);
}
