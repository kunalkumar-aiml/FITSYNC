/**
 * A short built-in deny-list of the most common passwords (compiled from widely published breach top-lists).
 * It catches the passwords attackers try first. For a larger list, set up a breached-password check (see docs/SECURITY.md).
 */
export const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd", "p@ssw0rd", "p@ssword", "pass1234",
  "12345678", "123456789", "1234567890", "12345678910", "123123123", "11111111", "00000000", "87654321", "11223344",
  "qwertyui", "qwerty123", "qwerty12", "qwertyuiop", "1q2w3e4r", "1q2w3e4r5t", "1qaz2wsx", "zaq12wsx", "asdfghjk", "asdf1234",
  "zxcvbnm1", "iloveyou", "iloveyou1", "sunshine", "princess", "football", "baseball", "superman", "batman123", "starwars",
  "welcome1", "welcome123", "letmein1", "letmein123", "trustno1", "dragon123", "monkey123", "master123", "shadow123",
  "abcd1234", "abc12345", "abcdefgh", "aa123456", "a1234567", "admin123", "admin1234", "administrator", "changeme",
  "computer", "internet", "whatever", "freedom1", "michael1", "jennifer", "jordan23", "liverpool", "chelsea1", "arsenal1",
  "india123", "india@123", "bharat123", "krishna1", "ganesh123", "sachin10", "cricket1", "mumbai123", "delhi123",
  "password@1", "password@123", "pass@123", "admin@123", "test1234", "testtest", "guest123", "default1", "secret123",
  "fitsync1", "fitsync123", "fitsync2026", "mypassword", "yourpassword", "letmein!", "qazwsxedc", "q1w2e3r4", "q1w2e3r4t5",
  "1234qwer", "qwer1234", "pokemon1", "naruto123", "samsung1", "iphone123", "google123", "facebook1", "instagram",
]);
