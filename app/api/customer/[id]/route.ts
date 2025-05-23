import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';


// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// 고객 정보 업데이트
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.name) {
      return NextResponse.json({ success: false, message: '이름은 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    // 고객 ID가 없는 경우의 예외 처리
    const customerId = data.customerId || '';
    
    // Notion 페이지 속성 설정
    const properties = {
      'id': {
        title: [
          {
            text: {
              content: customerId,
            },
          },
        ],
      },
      '고객명': {
        rich_text: [
          {
            text: {
              content: data.name,
            },
          },
        ],
      },
      '전화번호': {
        phone_number: data.phone || null,
      },
      '성별': {
        select: data.gender ? { name: data.gender } : null,
      },
      '생년월일': {
        date: data.birth ? { start: data.birth } : null,
      },
      '추정나이': {
        number: data.estimatedAge ? parseInt(data.estimatedAge) : null,
      },
      '주소': {
        rich_text: data.address ? [
          {
            text: {
              content: data.address,
            },
          },
        ] : [],
      },
      'customerFolderId': {
        rich_text: data.customerFolderId ? [
          {
            text: {
              content: data.customerFolderId,
            },
          },
        ] : [],
      },
      '특이사항': {
        rich_text: data.specialNote ? [
          {
            text: {
              content: data.specialNote,
            },
          },
        ] : [],
      },
      
    };
    
    
    // 고객 정보 업데이트
    console.log(`고객 ID ${id} 정보 업데이트 중...`);
    
    await notion.pages.update({
      page_id: id,
      properties: properties
    });
    
    console.log(`고객 정보 업데이트 성공`);
    
    // 간소화된 응답 반환 (성공 여부만)
    return NextResponse.json({ 
      success: true, 
      message: '고객 정보가 업데이트되었습니다.'
    });
  } catch (error: any) {
    console.error('고객 정보 업데이트 오류:', error);
    return NextResponse.json({ 
      success: false,
      message: '고객 정보 업데이트 중 오류가 발생했습니다.',
      error: error.message
    }, { status: 500 });
  }
}

// 고객 정보 삭제 (아카이브)
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = await context.params;
  
  if (!id) {
    return NextResponse.json({ success: false, message: '고객 ID가 필요합니다.' }, { status: 400 });
  }
  
  try {
    // 노션에서는 완전 삭제 대신 아카이브 처리
    await notion.pages.update({
      page_id: id,
      archived: true
    });
    
    return NextResponse.json({ 
      success: true, 
      message: '고객 정보가 삭제되었습니다.' 
    });
  } catch (error: any) {
    console.error('고객 정보 삭제 오류:', error);
    return NextResponse.json({ 
      success: false,
      message: '고객 정보 삭제 중 오류가 발생했습니다.',
      error: error.message
    }, { status: 500 });
  }
} 