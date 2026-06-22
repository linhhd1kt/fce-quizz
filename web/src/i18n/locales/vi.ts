import type { Translations } from './en';

// Partial Vietnamese translations — missing keys fall back to English
export const vi: DeepPartial<Translations> = {
  nav: {
    home: 'Trang chủ',
    scores: 'Điểm số',
    import: 'Nhập',
  },
  home: {
    title: 'Luyện Thi',
    subtitle: 'Thực hành thi tương tác',
    loading: 'Đang tải bộ câu hỏi…',
    practiceSets: 'Bộ đề luyện tập',
    importedSets: 'Bộ đề đã nhập',
    remove: '✕ xoá',
    hasPdf: 'Có file PDF?',
    uploadLink: 'Tải lên & trích xuất câu hỏi',
    or: 'hoặc',
    importLink: 'nhập file JSON',
  },
  quizCard: {
    questions: '{count} câu',
    bestScore: 'Cao nhất: {score}%',
    start: 'Bắt đầu',
  },
  player: {
    getReady: 'Chuẩn bị…',
    finished: 'Hoàn thành!',
    viewResults: 'Xem kết quả →',
    exit: '← Thoát',
    correct: '🎉 Chính xác!',
    wrong: '😔 Chưa đúng — Đáp án: {answer}',
    timeout: '⏰ Hết giờ! Đáp án: {answer}',
    next: 'Tiếp theo →',
    seeResults: 'Xem kết quả 🎉',
  },
  results: {
    loading: 'Đang tải kết quả…',
    yourScore: 'Điểm của bạn',
    correctAnswer: '✓ Đúng',
    wrongAnswer: '✗ Sai — đã chọn: {answer}',
    noAnswer: '(không trả lời)',
    tryAgain: 'Làm lại',
    home: '← Trang chủ',
  },
  teacher: {
    exit: '← Thoát',
    roleBadge: 'GIÁO VIÊN',
    playBtn: 'Làm bài →',
    tabAnswers: 'Đáp án',
    tabQuestions: 'Câu hỏi',
    tabSkippedLabel: 'Bỏ qua',
    correctLabel: '✓ Đúng',
    explanationLabel: 'Giải thích:',
    backToQuiz: '← Quay lại quiz',
    homeLink: 'Trang chủ',
  },
};

// Utility type — recursive partial
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
