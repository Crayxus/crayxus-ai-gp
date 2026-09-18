// EI TOKEN 案例 · 呼吸灯
// 灯光慢慢亮起再慢慢变暗，像在呼吸
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int LED_PIN = 18;
#elif defined(ESP32)
const int LED_PIN = 26;
#else
const int LED_PIN = 9;
#endif

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("EIT breathing ready");
}

void loop() {
  for (int v = 0; v <= 255; v += 5) { analogWrite(LED_PIN, v); delay(15); }   // 慢慢变亮
  for (int v = 255; v >= 0; v -= 5) { analogWrite(LED_PIN, v); delay(15); }   // 慢慢变暗
  Serial.println("breath");
}
