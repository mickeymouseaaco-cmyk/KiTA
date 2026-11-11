/**
 * Teka-teki: a Malay riddle on Home that changes every 30 minutes, the same
 * one for both of you at the same time. Pure, so it's easy to test.
 */

export type TekaTeki = { soalan: string; jawapan: string };

export const SLOT_MS = 30 * 60_000;

export const TEKA_TEKI: readonly TekaTeki[] = [
  { soalan: 'Apa yang ada kaki tetapi tidak boleh berjalan?', jawapan: 'Meja' },
  { soalan: 'Apa yang ada mata tetapi tidak boleh melihat?', jawapan: 'Jarum' },
  { soalan: 'Apa yang ada gigi tetapi tidak boleh menggigit?', jawapan: 'Sikat' },
  { soalan: 'Apa yang ada leher tetapi tiada kepala?', jawapan: 'Botol' },
  { soalan: 'Apa yang ada muka dan jarum, tetapi tidak boleh menjahit?', jawapan: 'Jam' },
  { soalan: 'Apa yang makin digali makin besar?', jawapan: 'Lubang' },
  { soalan: 'Apa yang sentiasa naik tetapi tidak pernah turun?', jawapan: 'Umur' },
  { soalan: 'Apa yang pecah sebaik sahaja namanya disebut?', jawapan: 'Kesunyian' },
  { soalan: 'Apa yang makin basah ketika ia mengeringkan?', jawapan: 'Tuala' },
  { soalan: 'Apa yang berjalan tanpa kaki dan tidak boleh diundur?', jawapan: 'Masa' },
  { soalan: 'Apa yang ada banyak kunci tetapi tidak boleh membuka pintu?', jawapan: 'Piano' },
  { soalan: 'Bulat seperti bola, kulitnya berduri, baunya kuat, digelar raja segala buah. Apakah dia?', jawapan: 'Durian' },
  { soalan: 'Rumahnya dibawa ke mana sahaja dia pergi. Siapakah dia?', jawapan: 'Siput' },
  { soalan: 'Apa yang selalu turun tetapi tidak pernah naik?', jawapan: 'Hujan' },
  { soalan: 'Apa yang terbang tinggi tanpa sayap, tetapi diikat dengan tali?', jawapan: 'Layang-layang' },
  { soalan: 'Apa yang ada kepala dan ekor, tetapi tiada badan?', jawapan: 'Duit syiling' },
  { soalan: 'Apa yang boleh memenuhi sebuah bilik tetapi tidak mengambil ruang?', jawapan: 'Cahaya' },
  { soalan: 'Apa yang mesti dipecahkan dahulu sebelum boleh digunakan?', jawapan: 'Telur' },
  { soalan: 'Apa yang menjawab tanpa mulut bila kita menjerit di dalam gua?', jawapan: 'Gema' },
  { soalan: 'Huruf apakah yang boleh diminum?', jawapan: 'T (teh)' },
  { soalan: 'Ia mengikut kamu ke mana-mana, tetapi hilang dalam gelap. Apakah dia?', jawapan: 'Bayang-bayang' },
  { soalan: 'Bila kamu kongsikan, saya tidak lagi wujud. Apakah saya?', jawapan: 'Rahsia' },
  { soalan: 'Ia milik kamu, tetapi orang lain lebih kerap menggunakannya. Apakah dia?', jawapan: 'Nama kamu' },
  { soalan: 'Airnya di dalam, isinya putih, kulitnya keras dan berserabut. Apakah dia?', jawapan: 'Kelapa' },
  { soalan: 'Kulitnya kuning, isinya manis, monyet sangat menyukainya. Apakah dia?', jawapan: 'Pisang' },
  { soalan: 'Bila hujan dia kembang, bila tidak digunakan dia kuncup. Apakah dia?', jawapan: 'Payung' },
  { soalan: 'Makin lama makin pendek, menangis sambil menerangi. Apakah dia?', jawapan: 'Lilin' },
  { soalan: 'Ia menunjukkan wajah kamu, tetapi ia sendiri tiada mata. Apakah dia?', jawapan: 'Cermin' },
  { soalan: 'Ada bandar tetapi tiada rumah, ada sungai tetapi tiada air. Apakah dia?', jawapan: 'Peta' },
  { soalan: 'Ia sentiasa akan datang, tetapi tidak pernah tiba. Apakah dia?', jawapan: 'Esok' },
  { soalan: 'Sentiasa berpasangan, dipijak setiap hari, tetapi tidak pernah merungut. Apakah dia?', jawapan: 'Kasut' },
  { soalan: 'Setiap malam kepalamu di atasku, tetapi aku tidak pernah mengeluh. Siapakah aku?', jawapan: 'Bantal' },
  { soalan: 'Waktu siang ia ada tetapi tidak kelihatan, waktu malam ia berkelip-kelip. Apakah dia?', jawapan: 'Bintang' },
  { soalan: 'Beri makan, dia hidup. Beri minum, dia mati. Apakah dia?', jawapan: 'Api' },
  { soalan: 'Aku air tetapi keras. Letak aku di bawah matahari, aku menangis. Apakah aku?', jawapan: 'Ais' },
  { soalan: 'Ia naik dan turun, tetapi tidak pernah bergerak. Apakah dia?', jawapan: 'Tangga' },
  { soalan: 'Ia pergi dari bandar ke bandar, tetapi tidak pernah bergerak. Apakah dia?', jawapan: 'Jalan raya' },
  { soalan: 'Makin digunakan makin kecil, tetapi membuat kita bersih dan wangi. Apakah dia?', jawapan: 'Sabun' },
  { soalan: 'Makin diraut makin pendek, tetapi tulisannya makin banyak. Apakah dia?', jawapan: 'Pensel' },
  { soalan: 'Muncul selepas hujan, ada tujuh warna, tetapi tidak boleh dipegang. Apakah dia?', jawapan: 'Pelangi' },
  { soalan: 'Kecil tetapi rajin, menghasilkan sesuatu yang manis, dan ada sengat. Apakah dia?', jawapan: 'Lebah' },
  { soalan: 'Tumbuh di atas kepala, dipotong tidak terasa sakit. Apakah dia?', jawapan: 'Rambut' },
  { soalan: 'Boleh patah tanpa bunyi, boleh dicuri tanpa pencuri ditangkap. Apakah dia?', jawapan: 'Hati' },
  { soalan: 'Tidak nampak, tidak boleh dipegang, tetapi makin jauh makin terasa. Apakah dia?', jawapan: 'Rindu' },
  { soalan: 'Makin dikongsi, makin bertambah. Apakah dia?', jawapan: 'Kasih sayang' },
  { soalan: 'Diberi percuma tetapi sangat berharga, dan selalunya dibalas. Apakah dia?', jawapan: 'Senyuman' },
  { soalan: 'Ringan seperti bulu, tetapi orang paling kuat pun tidak boleh menahannya lama. Apakah dia?', jawapan: 'Nafas' },
  { soalan: 'Datang ketika tidur, pergi ketika bangun. Apakah dia?', jawapan: 'Mimpi' },
  { soalan: 'Panjang berbaris, berjalan di atas besi, singgah di setiap stesen. Apakah dia?', jawapan: 'Kereta api' },
  { soalan: 'Apa yang boleh kamu pegang tanpa menggunakan tangan?', jawapan: 'Janji' },
];

/** The riddle for this 30-minute slot. 7 and 50 share no factor, so every riddle comes round before any repeats. */
export function tekaTekiAt(nowMs: number): { item: TekaTeki; slot: number; nextAtMs: number } {
  const slot = Math.floor(nowMs / SLOT_MS);
  const n = TEKA_TEKI.length;
  const i = (((slot * 7) % n) + n) % n;
  return { item: TEKA_TEKI[i], slot, nextAtMs: (slot + 1) * SLOT_MS };
}

/** "dalam 12 minit", "dalam 1 minit". */
export function nextIn(nowMs: number, nextAtMs: number): string {
  const min = Math.max(1, Math.ceil((nextAtMs - nowMs) / 60_000));
  return `dalam ${min} minit`;
}
