import { RelatedStoryItem, StoryComment } from '../domain/story.models';

export const MOCK_STORY_COMMENTS: readonly StoryComment[] = [
  { id: '1', user: 'MinhTu99', time: '10 phút trước', content: 'Main ẩn giấu thực lực đỉnh vãi, mong ra chương mới nhanh!' },
  { id: '2', user: 'ThanhPha', time: '1 giờ trước', content: 'Bộ này nét vẽ đẹp mà cốt truyện cuốn thế nhở.' },
  { id: '3', user: 'PhamHoang', time: '3 giờ trước', content: 'Chương 318 quay xe khét lẹt luôn hóng chương 319.' },
  { id: '4', user: 'DucAnh', time: '5 giờ trước', content: 'Hay quá ad ơi, ra bão chương đi!' },
];

export const MOCK_RELATED_STORIES: readonly RelatedStoryItem[] = [
  { title: 'Vạn Giới Tiên Vương', slug: 'van-gioi-tien-vuong', coverUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80', latestChapter: 976 },
  { title: 'Thanh Gươm Diệt Quỷ', slug: 'thanh-guom-diet-quy', coverUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=150&auto=format&fit=crop&q=80', latestChapter: 205 },
  { title: 'Nhất Niệm Vĩnh Hằng', slug: 'nhat-niem-vinh-hang', coverUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80', latestChapter: 1403 },
];
