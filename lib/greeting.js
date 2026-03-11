export function getGreeting() {
  const hour = new Date().getHours();
  
  // Menambahkan emoji yang sesuai dengan suasana waktu
  if (hour >= 4 && hour < 11) {
    return { text: "Pagi", emoji: "🌅" };
  } else if (hour >= 11 && hour < 15) {
    return { text: "Siang", emoji: "☀️" };
  } else if (hour >= 15 && hour < 18) {
    return { text: "Sore", emoji: "🌇" };
  } else {
    return { text: "Malam", emoji: "🌙" };
  }
}