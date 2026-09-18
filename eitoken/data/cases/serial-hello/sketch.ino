// EI TOKEN 案例 · 串口对话
// 在串口输入 on / off，远程开关灯
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
  Serial.println("EIT serial-hello ready");
  Serial.println("输入 on 或 off 试试");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "on")       { digitalWrite(LED_PIN, HIGH); Serial.println("LED ON"); }
    else if (cmd == "off") { digitalWrite(LED_PIN, LOW);  Serial.println("LED OFF"); }
    else if (cmd.length()) { Serial.print("unknown: "); Serial.println(cmd); }
  }
}
