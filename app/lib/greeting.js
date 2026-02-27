export function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 4 && hour < 11) {
    return {
      text: "Selamat Pagi! ☀️",
      subtitle: "Awali hari dengan eksplorasi sekitar"
    };
  }

  if (hour >= 10 && hour < 15) {
    return {
      text: "Selamat Siang! 🌤️",
      subtitle: "Ada banyak tempat menarik di dekatmu"
    };
  }

  if (hour >= 15 && hour < 18) {
    return {
      text: "Selamat Sore! 🌅",
      subtitle: "Waktu santai, coba lihat sekitar"
    };
  }

  return {
    text: "Selamat Malam! 🌙",
    subtitle: "Saatnya kulineran atau nongkrong dekatmu"
  };
}