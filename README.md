# MSP 프로젝트

노션 데이터베이스와 연동하여 일일 수입과 지출을 관리하는 Next.js 프로젝트입니다.

## 다른 컴퓨터에서 작업하기

1. 프로젝트 클론하기:
```bash
git clone [저장소 URL]
cd msp
```

2. 의존성 설치:
```bash
npm install
```

3. 환경 변수 설정:
`.env.local` 파일을 다음과 같이 생성하세요:
```
HTTPS=true
NODE_TLS_REJECT_UNAUTHORIZED=0
```

4. 노션 API 설정:
`app/api/notion.ts` 파일에서 노션 API 키와 데이터베이스 ID를 업데이트하세요.

5. 개발 서버 실행:
```bash
# 일반 HTTP 모드
npm run dev

# HTTPS 모드 (카메라 기능 사용 시)
npm run dev:https
```

## 주요 기능

- 일일 수입/지출 관리
- 노션 데이터베이스 연동
- 영수증 스캔 및 데이터 추출
- 약품 사진 촬영 및 인식

## 기술 스택

- Next.js 15
- React 19
- TypeScript
- Notion API
- OpenAI API
- Anthropic API

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# 상담 일지 관리 시스템

## 파일 업로드 및 노션 데이터베이스 연동 가이드

### Google Drive에 이미지 업로드하기

이미지를 Google Drive에 업로드하려면 `/api/google-drive` API를 사용합니다.

```javascript
// 이미지 업로드 예시
const response = await fetch('/api/google-drive', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    imageData: base64ImageData,  // Base64 인코딩된 이미지 데이터
    fileName: 'my_image.jpg'     // 선택사항: 파일명
  })
});

const data = await response.json();
if (data.success) {
  // 업로드 성공
  const fileId = data.fileId;           // Google Drive 파일 ID
  const notionRelationId = data.notionRelationId; // 노션 relation에 사용할 ID (fileId와 동일)
  const viewUrl = data.viewUrl;         // 파일 보기 URL
  const downloadUrl = data.downloadUrl; // 파일 다운로드 URL
}
```

### 노션 상담일지에 이미지 저장하기

노션 상담일지의 `증상이미지` 필드는 `relation` 타입으로 설정되어 있습니다. 이미지를 저장할 때는 Google Drive 파일 ID를 사용해야 합니다.

```javascript
// 상담일지 저장 예시
const saveConsultation = async () => {
  // Google Drive에 이미지 업로드 후 받은 파일 ID 배열
  const imageIds = ['fileId1', 'fileId2']; 

  const response = await fetch('/api/consultation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerId: 'customer_id',
      consultDate: '2023-05-01',
      content: '상담 내용...',
      medicine: '처방약...',
      result: '결과...',
      // 중요: 이미지 ID를 직접 전달
      imageIds: imageIds
    })
  });

  const data = await response.json();
  if (data.success) {
    // 상담일지 저장 성공
  }
};
```

### 주의사항

1. 노션 데이터베이스의 `증상이미지` 필드는 `relation` 타입이므로, Google Drive 파일 ID를 직접 전달해야 합니다.
2. 구글 드라이브 API 응답의 `fileId` 또는 `notionRelationId`를 사용하세요.
3. 이미지 URL을 직접 전달하는 방식은 지원되지 않습니다.