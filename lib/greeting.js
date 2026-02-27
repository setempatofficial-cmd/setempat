export function getGreeting() {
  const hour = new Date().getHours();
  
  if (hour >= 4 && hour < 11) {
    return { text: "Selamat pagi!", emoji: "☀️" };
  } else if (hour >= 11 && hour < 15) {
    return { text: "Selamat siang!", emoji: "🌤️" };
  } else if (hour >= 15 && hour < 18) {
    return { text: "Selamat sore!", emoji: "⛅" };
  } else {
    return { text: "Selamat malam!", emoji: "🌙" };
  }
}