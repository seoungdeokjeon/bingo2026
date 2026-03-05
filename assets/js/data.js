(function () {
  const STORAGE_KEY = 'bingo2026_state_v1';

  const BASE_TEXTS = [
    '새로운 취미 시작', '한 달 독서 2권', '아침 산책 10회', '친구와 여행', '운동 루틴 정착',
    '새 레시피 도전', '늦잠 없는 주말', '포토북 만들기', '미뤄둔 서류 정리', '재밌는 전시 관람',
    '가계부 3개월 유지', '셀프 칭찬 30회', '하루 물 2L', '영화관에서 영화 3편', '새 플레이리스트 만들기',
    '안 쓰는 물건 기부', '매일 스트레칭 20일', '주 1회 일기 쓰기', '가족과 외식', '기념일 챙기기',
    '디지털 디톡스 하루', '새 카페 발굴 5곳', '친구 생일 선물 준비', '계단 이용 습관', '주간 목표 달성',
    '요리 사진 남기기', '야외 피크닉', '봄꽃 보러 가기', '비 오는 날 산책', '한 달 군것질 줄이기',
    '손편지 써보기', '새 언어 표현 20개', '드라마 정주행 완료', '하루 30분 공부', '작은 봉사 참여'
  ];

  const BASE_EMOJIS = [
    '🌟', '🌈', '🎀', '🧸', '🍀', '☀️', '🍓', '🎵', '🫧', '🐰',
    '🌼', '🧁', '📚', '🎬', '🏃', '🍵', '💌', '🧩', '🌷', '✨',
    '💖', '🎉', '🛼', '🧃', '🪴', '🍰', '🌙', '🧘', '🎨', '🐣'
  ];

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function makeRandomBoard() {
    const texts = shuffle(BASE_TEXTS).slice(0, 25);
    const emojis = shuffle(BASE_EMOJIS);
    return texts.map(function (text, i) {
      return {
        text: text,
        emoji: emojis[i % emojis.length],
        checked: false
      };
    });
  }

  window.BingoData = {
    STORAGE_KEY: STORAGE_KEY,
    makeRandomBoard: makeRandomBoard
  };
})();
