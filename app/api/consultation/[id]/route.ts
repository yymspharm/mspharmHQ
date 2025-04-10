import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CONSULTATION_SCHEMA, NOTION_ENV_VARS } from '@/app/lib/notion-schema';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env[NOTION_ENV_VARS.API_KEY],
});

// 상담일지 수정
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  if (!id) {
    return NextResponse.json({ error: '상담일지 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.content) {
      return NextResponse.json({ error: '상담내용은 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    // 노션 API 형식으로 데이터 변환
    const properties: any = {
      '상담내용': {
        [CONSULTATION_SCHEMA.상담내용.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.content 
            } 
          }
        ]
      }
    };
    
    // 상담일자 정보가 있는 경우
    if (data.consultDate) {
      properties['상담일자'] = {
        [CONSULTATION_SCHEMA.상담일자.type]: {
          start: data.consultDate
        }
      };
    }
    
    // 처방약 정보가 있는 경우
    if (data.medicine) {
      properties['처방약'] = {
        [CONSULTATION_SCHEMA.처방약.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.medicine 
            } 
          }
        ]
      };
    }
    
    // 결과 정보가 있는 경우
    if (data.result) {
      properties['결과'] = {
        [CONSULTATION_SCHEMA.결과.type]: [
          { 
            type: 'text', 
            text: { 
              content: data.result 
            } 
          }
        ]
      };
    }
    
    // 새 이미지 URL이 제공된 경우, 기존 이미지를 업데이트 (추가)
    if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
      // 먼저 현재 이미지 가져오기
      const pageResponse = await notion.pages.retrieve({ page_id: id });
      let existingImages = [];
      
      // @ts-expect-error - 타입 정의 문제 해결
      if (pageResponse.properties?.증상이미지?.files && 
          // @ts-expect-error - 타입 정의 문제 해결
          Array.isArray(pageResponse.properties.증상이미지.files)) {
        // @ts-expect-error - 타입 정의 문제 해결
        existingImages = pageResponse.properties.증상이미지.files;
      }
      
      // 새 이미지를 기존 이미지에 추가 (Notion에 보낼 형식)
      const allImages = [
        ...existingImages,
        ...data.imageUrls.map((url: string, index: number) => ({
          type: 'external',
          name: `새로운_이미지_${index + 1}.jpg`,
          external: {
            url: url
          }
        }))
      ];
      
      // 이미지 속성 업데이트
      properties['증상이미지'] = {
        [CONSULTATION_SCHEMA.증상이미지.type]: allImages
      };
    }
    
    // 상담일지 업데이트
    const response = await notion.pages.update({
      page_id: id,
      properties: properties
    });
    
    return NextResponse.json({ success: true, consultation: response });
  } catch (error) {
    console.error('상담일지 수정 오류:', error);
    return NextResponse.json({ error: '상담일지 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 상담일지 삭제
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  if (!id) {
    return NextResponse.json({ error: '상담일지 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    // Notion API는 실제 삭제 대신 보관(아카이브) 기능을 제공
    const response = await notion.pages.update({
      page_id: id,
      archived: true
    });
    
    return NextResponse.json({ success: true, message: '상담일지가 삭제되었습니다.' });
  } catch (error) {
    console.error('상담일지 삭제 오류:', error);
    return NextResponse.json({ error: '상담일지 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 