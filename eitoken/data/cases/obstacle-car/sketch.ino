// EI TOKEN 案例 · 避障小车
// 前面有障碍就后退转弯，没有就一直往前开
// 适用：Arduino Uno / Arduino Nano / ESP32 DevKit / ESP32-S3 DevKitC

#if defined(CONFIG_IDF_TARGET_ESP32S3)
const int ENA = 7;
const int IN1 = 16;
const int IN2 = 17;
const int ENB = 15;
const int IN3 = 6;
const int IN4 = 5;
const int TRIG_PIN = 39;
const int ECHO_PIN = 40;
#elif defined(ESP32)
const int ENA = 18;
const int IN1 = 23;
const int IN2 = 25;
const int ENB = 19;
const int IN3 = 17;
const int IN4 = 16;
const int TRIG_PIN = 14;
const int ECHO_PIN = 13;
#else
const int ENA = 5;
const int IN1 = 7;
const int IN2 = 8;
const int ENB = 6;
const int IN3 = 4;
const int IN4 = 3;
const int TRIG_PIN = 11;
const int ECHO_PIN = 12;
#endif

void motor(int en, int a, int b, int speed) {
  digitalWrite(a, speed >= 0 ? HIGH : LOW);
  digitalWrite(b, speed >= 0 ? LOW : HIGH);
  analogWrite(en, abs(speed));
}
void drive(int left, int right) { motor(ENA, IN1, IN2, left); motor(ENB, IN3, IN4, right); }

long distanceCm() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long us = pulseIn(ECHO_PIN, HIGH, 30000UL);
  return us == 0 ? 999 : us * 0.0343 / 2;
}

void setup() {
  Serial.begin(115200);
  int outs[] = {ENA, IN1, IN2, ENB, IN3, IN4, TRIG_PIN};
  for (int i = 0; i < 7; i++) pinMode(outs[i], OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  Serial.println("EIT obstacle-car ready");
}

void loop() {
  long d = distanceCm();
  if (d > 25) {
    drive(180, 180); Serial.print("forward "); Serial.println(d);
  } else {
    Serial.print("obstacle "); Serial.println(d);
    drive(-150, -150); delay(400);   // 先后退
    drive(-160, 160);  delay(350);   // 原地转向
  }
  delay(60);
}
