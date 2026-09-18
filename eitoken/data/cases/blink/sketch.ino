// EI TOKEN 案例 · 闪烁 LED
// 让灯一秒闪一次，确认板子、驱动、烧录全都通了
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int LED_PIN = 2;
#elif defined(ESP32)
const int LED_PIN = 2;
#else
const int LED_PIN = 13;
#endif

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("EIT blink ready");
}

void loop() {
  digitalWrite(LED_PIN, HIGH);   // 灯亮
  Serial.println("LED ON");
  delay(500);
  digitalWrite(LED_PIN, LOW);    // 灯灭
  Serial.println("LED OFF");
  delay(500);
}
