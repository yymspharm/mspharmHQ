import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { CUSTOMER_SCHEMA, NOTION_ENV_VARS, NotionCustomer } from '@/app/lib/notion-schema';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env[NOTION_ENV_VARS.API_KEY],
});

// 고객 데이터베이스 ID
const customerDbId = process.env[NOTION_ENV_VARS.CUSTOMER_DB_ID];

// 고객 정보 조회
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const phone = searchParams.get('phone');
  const gender = searchParams.get('gender');
  
  if (!customerDbId) {
    return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  try {
    let filter = {};
    
    if (name) {
      filter = {
        property: '고객명',
        [CUSTOMER_SCHEMA.고객명.type]: {
          contains: name,
        },
      };
    } else if (phone) {
      filter = {
        property: '전화번호',
        [CUSTOMER_SCHEMA.전화번호.type]: {
          contains: phone,
        },
      };
    } else if (gender) {
      filter = {
        property: '성별',
        [CUSTOMER_SCHEMA.성별.type]: {
          equals: gender,
        },
      };
    } else {
      // 파라미터가 없으면 빈 결과를 반환
      return NextResponse.json({ success: true, customers: [] });
    }
    
    const response = await notion.databases.query({
      database_id: customerDbId,
      filter: Object.keys(filter).length > 0 ? filter as any : undefined,
    });
    
    return NextResponse.json({ success: true, customers: response.results });
  } catch (error) {
    console.error('고객 정보 조회 오류:', error);
    return NextResponse.json({ error: '고객 정보 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 고객 정보 저장
export async function POST(request: Request) {
  if (!customerDbId) {
    return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  try {
    const data = await request.json();
    
    // 필수 필드 검증
    if (!data.name) {
      return NextResponse.json({ error: '이름은 필수 입력 항목입니다.' }, { status: 400 });
    }
    
    // 노션 API 형식에 맞게 데이터 변환
    const properties: any = {
      '고객명': {
        [CUSTOMER_SCHEMA.고객명.type]: [{ type: 'text', text: { content: data.name } }]
      }
    };
    
    if (data.phone) {
      properties['전화번호'] = {
        [CUSTOMER_SCHEMA.전화번호.type]: data.phone
      };
    }
    
    if (data.gender) {
      properties['성별'] = {
        [CUSTOMER_SCHEMA.성별.type]: {
          name: data.gender
        }
      };
    }
    
    if (data.birth) {
      properties['생년월일'] = {
        [CUSTOMER_SCHEMA.생년월일.type]: {
          start: data.birth
        }
      };
    }
    
    if (data.address) {
      properties['주소'] = {
        [CUSTOMER_SCHEMA.주소.type]: [{ type: 'text', text: { content: data.address } }]
      };
    }
    
    // 사진 URL이 제공된 경우
    if (data.photoUrl) {
      // URL 길이 확인 - 노션 API 제한(2000자)
      if (data.photoUrl.length <= 2000) {
        properties['사진'] = {
          [CUSTOMER_SCHEMA.사진.type]: [
            {
              type: 'external',
              name: `${data.name}_photo.jpg`,
              external: {
                url: data.photoUrl
              }
            }
          ]
        };
      } else {
        console.warn('사진 URL이 너무 길어 저장하지 않습니다 (길이: ' + data.photoUrl.length + ')');
      }
    }
    
    // 얼굴 임베딩 데이터가 제공된 경우
    if (data.faceEmbedding) {
      properties['얼굴_임베딩'] = {
        [CUSTOMER_SCHEMA.얼굴_임베딩.type]: [
          { 
            type: 'text', 
            text: { 
              content: typeof data.faceEmbedding === 'string' 
                ? data.faceEmbedding 
                : JSON.stringify(data.faceEmbedding) 
            } 
          }
        ]
      };
    }
    
    // 새 고객 생성
    const response = await notion.pages.create({
      parent: { database_id: customerDbId },
      properties: properties
    });
    
    return NextResponse.json({ success: true, customer: response });
  } catch (error) {
    console.error('고객 정보 저장 오류:', error);
    return NextResponse.json({ error: '고객 정보 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 얼굴 임베딩 데이터로 고객 검색
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!customerDbId) {
    return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  try {
    const data = await request.json();
    
    // 임베딩 데이터 필요
    if (!data.faceEmbedding) {
      return NextResponse.json({ error: '얼굴 임베딩 데이터가 필요합니다.' }, { status: 400 });
    }
    
    // 모든 고객 정보 조회
    const response = await notion.databases.query({
      database_id: customerDbId,
      filter: {
        property: '얼굴_임베딩',
        rich_text: {
          is_not_empty: true
        }
      }
    });
    
    const customers = response.results;
    if (customers.length === 0) {
      return NextResponse.json({ success: true, customers: [] });
    }
    
    // 각 고객의 임베딩 데이터와 유사도 계산
    const inputEmbedding = typeof data.faceEmbedding === 'string' 
      ? JSON.parse(data.faceEmbedding) 
      : data.faceEmbedding;
    
    console.log('입력 얼굴 임베딩:', {
      성별: inputEmbedding.gender,
      나이: inputEmbedding.age,
      눈거리: inputEmbedding.embedding?.eyeDistanceRatio,
      눈코비율: inputEmbedding.embedding?.eyeNoseRatio,
      코입비율: inputEmbedding.embedding?.noseMouthRatio,
      윤곽: inputEmbedding.embedding?.contourFeatures
    });
    
    // 임베딩 구조 정규화 - 서로 다른 구조를 일관되게 처리
    const normalizedInputEmbedding = {
      eyeDistanceRatio: inputEmbedding.embedding?.eyeDistanceRatio || inputEmbedding.eyeDistanceRatio,
      eyeNoseRatio: inputEmbedding.embedding?.eyeNoseRatio || inputEmbedding.eyeNoseRatio,
      noseMouthRatio: inputEmbedding.embedding?.noseMouthRatio || inputEmbedding.noseMouthRatio,
      symmetryScore: inputEmbedding.embedding?.symmetryScore || inputEmbedding.symmetryScore,
      contourFeatures: inputEmbedding.embedding?.contourFeatures || inputEmbedding.contourFeatures,
      gender: inputEmbedding.gender,
      age: inputEmbedding.age,
      imageQualityScore: inputEmbedding.imageQualityScore || 70
    };
    
    // 모든 필수 필드가 있는지 확인하고 없으면 기본값으로 채움
    if (normalizedInputEmbedding.eyeDistanceRatio === undefined) normalizedInputEmbedding.eyeDistanceRatio = 0.45;
    if (normalizedInputEmbedding.eyeNoseRatio === undefined) normalizedInputEmbedding.eyeNoseRatio = 0.35;
    if (normalizedInputEmbedding.noseMouthRatio === undefined) normalizedInputEmbedding.noseMouthRatio = 0.25;
    if (normalizedInputEmbedding.symmetryScore === undefined) normalizedInputEmbedding.symmetryScore = 0.8;
    if (!normalizedInputEmbedding.contourFeatures) {
      normalizedInputEmbedding.contourFeatures = normalizedInputEmbedding.gender === "남성" ? "각진 형태" : "둥근 형태";
    }
    
    console.log('정규화된 임베딩 데이터:', normalizedInputEmbedding);
    
    const matchedCustomers: { customer: any, similarity: number }[] = [];
    
    for (const customer of customers) {
      try {
        // @ts-expect-error - 타입 정의 문제
        const embeddingText = customer.properties['얼굴_임베딩'][CUSTOMER_SCHEMA.얼굴_임베딩.type][0]?.text?.content || '';
        
        if (embeddingText) {
          const customerEmbedding = JSON.parse(embeddingText);
          
          // 성별이 완전히 다르면 매칭하지 않음 
          // (남성/여성이 명확히 지정된 경우에만 적용)
          const genderMismatch = 
            inputEmbedding.gender && 
            customerEmbedding.gender && 
            inputEmbedding.gender !== customerEmbedding.gender &&
            inputEmbedding.gender !== '불명확' && 
            customerEmbedding.gender !== '불명확';
          
          // 나이 차이가 너무 많으면 매칭하지 않음 (20세 이상 차이)
          const ageMismatch = 
            typeof inputEmbedding.age === 'number' && 
            typeof customerEmbedding.age === 'number' && 
            Math.abs(inputEmbedding.age - customerEmbedding.age) > 20;
          
          // 성별이나 나이가 명확히 불일치하면 건너뜀
          if (genderMismatch || ageMismatch) {
            console.log(`고객 ${customer.id} 건너뜀: 성별/나이 불일치`);
            continue;
          }
          
          const similarity = calculateFaceSimilarity(normalizedInputEmbedding, customerEmbedding);
          
          console.log(`고객 ${getCustomerName(customer)} 유사도: ${(similarity * 100).toFixed(1)}%`);
          
          // 유사도 임계값을 0.6으로 설정 (더 엄격한 매칭)
          if (similarity > 0.6) {
            matchedCustomers.push({
              customer,
              similarity
            });
          }
        }
      } catch (err) {
        console.warn('고객 임베딩 처리 오류:', err);
        // 오류가 있는 고객은 건너뜀
      }
    }
    
    // 매칭된 고객 데이터 반환
    if (matchedCustomers.length > 0) {
      // 유사도 기준으로 정렬 (내림차순)
      matchedCustomers.sort((a, b) => b.similarity - a.similarity);
      
      // 모든 유사도 정보를 클라이언트에 제공
      const similarities = matchedCustomers.map(match => match.similarity);
      
      // 결과에 고객 정보와 유사도 정보 포함
      return NextResponse.json({
        success: true,
        customers: matchedCustomers.map(match => match.customer),
        similarities: similarities,
        message: `${matchedCustomers.length}명의 고객이 매칭되었습니다.`
      });
    } else {
      // 매칭된 고객이 없는 경우
      return NextResponse.json({
        success: false,
        customers: [],
        similarities: [],
        message: '매칭된 고객이 없습니다.'
      });
    }
  } catch (error) {
    console.error('얼굴 인식 검색 오류:', error);
    return NextResponse.json({ error: '얼굴 인식 검색 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 얼굴 유사도 계산 함수
function calculateFaceSimilarity(embedding1: any, embedding2: any): number {
  try {
    // 임베딩 객체가 유효한지 확인
    if (!embedding1 || !embedding2) {
      return 0;
    }

    // 로그 출력 - 디버깅용
    console.log('유사도 계산 입력값:', {
      embedding1: {
        eyeDistanceRatio: embedding1.eyeDistanceRatio,
        eyeNoseRatio: embedding1.eyeNoseRatio,
        noseMouthRatio: embedding1.noseMouthRatio,
        symmetryScore: embedding1.symmetryScore,
        contourFeatures: embedding1.contourFeatures
      },
      embedding2: {
        eyeDistanceRatio: embedding2.eyeDistanceRatio,
        eyeNoseRatio: embedding2.eyeNoseRatio,
        noseMouthRatio: embedding2.noseMouthRatio,
        symmetryScore: embedding2.symmetryScore,
        contourFeatures: embedding2.contourFeatures
      }
    });
    
    // 얼굴 특징 임베딩 유사도 계산
    let featureSimilarity = 0;
    let featureWeight = 0;
    
    // 눈 거리 비율 비교 (있는 경우만)
    if (typeof embedding1.eyeDistanceRatio === 'number' && typeof embedding2.eyeDistanceRatio === 'number') {
      const eyeDistanceDiff = Math.abs(embedding1.eyeDistanceRatio - embedding2.eyeDistanceRatio);
      // 차이를 0~1 사이로 정규화 (0.2를 최대 차이로 가정)
      const normalizedDiff = Math.min(eyeDistanceDiff / 0.2, 1);
      featureSimilarity += (1 - normalizedDiff) * 0.25;
      featureWeight += 0.25;
    }
    
    // 눈-코 비율 비교
    if (typeof embedding1.eyeNoseRatio === 'number' && typeof embedding2.eyeNoseRatio === 'number') {
      const eyeNoseDiff = Math.abs(embedding1.eyeNoseRatio - embedding2.eyeNoseRatio);
      const normalizedDiff = Math.min(eyeNoseDiff / 0.2, 1);
      featureSimilarity += (1 - normalizedDiff) * 0.25;
      featureWeight += 0.25;
    }
    
    // 코-입 비율 비교
    if (typeof embedding1.noseMouthRatio === 'number' && typeof embedding2.noseMouthRatio === 'number') {
      const noseMouthDiff = Math.abs(embedding1.noseMouthRatio - embedding2.noseMouthRatio);
      const normalizedDiff = Math.min(noseMouthDiff / 0.2, 1);
      featureSimilarity += (1 - normalizedDiff) * 0.25;
      featureWeight += 0.25;
    }
    
    // 대칭성 점수 비교
    if (typeof embedding1.symmetryScore === 'number' && typeof embedding2.symmetryScore === 'number') {
      const symmetryDiff = Math.abs(embedding1.symmetryScore - embedding2.symmetryScore);
      featureSimilarity += (1 - symmetryDiff) * 0.15;
      featureWeight += 0.15;
    }
    
    // 윤곽 특징 비교 (텍스트로 저장된 특징)
    if (embedding1.contourFeatures && embedding2.contourFeatures) {
      const contourSimilarity = embedding1.contourFeatures === embedding2.contourFeatures ? 1 : 0.5;
      featureSimilarity += contourSimilarity * 0.1;
      featureWeight += 0.1;
    }
    
    // 가중치를 고려한 최종 얼굴 특징 유사도
    const finalFeatureSimilarity = featureWeight > 0 ? featureSimilarity / featureWeight : 0;
    
    // 나이 유사도 계산 (나이 차이가 5살 이내면 높은 유사도)
    let ageSimilarity = 0;
    if (typeof embedding1.age === 'number' && typeof embedding2.age === 'number') {
      const ageDiff = Math.abs(embedding1.age - embedding2.age);
      ageSimilarity = Math.max(0, 1 - (ageDiff / 15)); // 15살 차이면 유사도 0
    }
    
    // 성별 유사도 (일치하면 1, 불일치하면 0)
    let genderSimilarity = 0;
    if (embedding1.gender && embedding2.gender) {
      genderSimilarity = embedding1.gender === embedding2.gender ? 1 : 0;
    }
    
    // 이미지 품질 점수로 가중치 조정 (높을수록 더 신뢰)
    let qualityFactor = 1.0;
    if (embedding1.imageQualityScore && embedding2.imageQualityScore) {
      const avgQuality = (embedding1.imageQualityScore + embedding2.imageQualityScore) / 2;
      qualityFactor = Math.max(0.7, avgQuality / 100); // 70%~100% 범위로 제한
    }
    
    // 최종 유사도 계산 (각 요소별 가중치 적용)
    const weights = {
      features: 0.6,  // 얼굴 특징이 가장 중요
      age: 0.2,       // 나이는 중간 정도 중요
      gender: 0.2     // 성별도 중간 정도 중요
    };
    
    const similarity = (
      (finalFeatureSimilarity * weights.features) +
      (ageSimilarity * weights.age) +
      (genderSimilarity * weights.gender)
    ) * qualityFactor;
    
    // 유사도를 0~1 범위로 제한하고 보정 (분포를 넓히기 위해)
    const adjustedSimilarity = Math.pow(Math.max(0, Math.min(1, similarity)), 1.5);
    
    console.log('유사도 계산:', {
      featureSimilarity: finalFeatureSimilarity.toFixed(3),
      ageSimilarity: ageSimilarity.toFixed(3),
      genderSimilarity: genderSimilarity.toFixed(3),
      qualityFactor: qualityFactor.toFixed(3),
      rawSimilarity: similarity.toFixed(3),
      adjustedSimilarity: adjustedSimilarity.toFixed(3)
    });
    
    return adjustedSimilarity;
  } catch (err) {
    console.error('유사도 계산 오류:', err);
    return 0; // 오류 발생 시 유사도 0 반환
  }
}

// 고객명 추출 도우미 함수
function getCustomerName(customer: any): string {
  try {
    // 타입 문제 해결
    return customer.properties['고객명']?.rich_text?.[0]?.text?.content || customer.id;
  } catch (err) {
    return customer.id;
  }
}

// 고객 정보 삭제
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!customerDbId) {
    return NextResponse.json({ error: '노션 고객 DB ID가 설정되지 않았습니다.' }, { status: 500 });
  }
  
  try {
    // 고객 정보 삭제 로직 구현
    // 이 부분은 구현되지 않았습니다. 필요한 경우 구현해야 합니다.
    return NextResponse.json({ error: '고객 정보 삭제 기능이 구현되지 않았습니다.' }, { status: 500 });
  } catch (error) {
    console.error('고객 정보 삭제 오류:', error);
    return NextResponse.json({ error: '고객 정보 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 