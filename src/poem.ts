export interface View {
  id: string;
  line: string;
  name: string;
  description: string;
  position: [number, number, number];
  target: [number, number, number];
  distance: [number, number];
}

export const overview: View = {
  id: 'overview', line: '山居秋暝', name: '秋山全景',
  description: '雨后的空山里，留一会儿。',
  position: [61, 43, 73], target: [0, 8, -6], distance: [58, 135],
};

export const verses: View[] = [
  { id: 'mountain', line: '空山新雨后', name: '雨后空山', description: '山色新洗，薄雾沿着石阶缓缓散去。', position: [8, 22, 46], target: [-8, 11, -18], distance: [25, 90] },
  { id: 'autumn', line: '天气晚来秋', name: '秋意渐深', description: '暮色落在疏林间，山风已带着秋意。', position: [-35, 16, 34], target: [-20, 9, 8], distance: [14, 50] },
  { id: 'moon', line: '明月松间照', name: '松间明月', description: '一轮明月，照见松针与山林的静。', position: [-7, 11, 13], target: [-24, 21, -30], distance: [22, 66] },
  { id: 'stream', line: '清泉石上流', name: '石上清泉', description: '清泉越过青石，把月光也带向山下。', position: [12, 12, 1], target: [-8, 3, -13], distance: [12, 42] },
  { id: 'bamboo', line: '竹喧归浣女', name: '竹径人归', description: '竹叶轻摇，洗衣归来的人走过山间小径。', position: [39, 13, 16], target: [23, 5, -1], distance: [12, 42] },
  { id: 'lotus', line: '莲动下渔舟', name: '莲动舟行', description: '渔舟缓缓顺水而下，拨开一塘莲影。', position: [33, 13, 38], target: [12, 1.4, 18], distance: [14, 48] },
  { id: 'flowers', line: '随意春芳歇', name: '芳歇秋来', description: '春花虽歇，秋草、落叶也自有清趣。', position: [-29, 11.5, 29], target: [-23, 5.5, 16], distance: [8, 30] },
  { id: 'home', line: '王孙自可留', name: '山居可留', description: '一盏灯，一座山居。这般秋色，便可长留。', position: [42, 23, -1], target: [26, 10, -20], distance: [15, 52] },
];
