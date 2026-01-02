// Test the upload API endpoint with a text file
require('dotenv').config({ path: '.env' });
const fs = require('fs');
const FormData = require('form-data');
let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  // Use global fetch if available (Node 18+)
  fetch = globalThis.fetch || require('node-fetch');
}

// Create a test text file with the PDF content
const testContent = `Грибы. Лишайники. Вирусы. Бактерии. Практические задания.

1. «Внешний вид и строение грибов». Подпишите структуры 1-6

2. Что содержится в черных шариках на концах длинных ответвлений у гриба мукора?
1) микроскопические плоды
2) питательные вещества
3) вода с минеральными солями
4) микроскопические споры
Эти черные шарики носят название -

3. Сахар превращается в спирт благодаря жизнедеятельности
1) пеницилла
2) мукора
3) головни
4) дрожжей
Как называется эта реакция?

4. Пеницилл отличается от мукора тем, что
1) пеницилл многоклеточный, а мукор одноклеточный гриб
2) пеницилл образует плесень на продуктах, а мукор нет
3) пеницилл размножается спорами, а мукор — грибницей
4) пеницилл — гетеротроф, а мукор — автотроф

5. Что представляет собой микориза?
1) грибокорень
2) грибницу, разросшуюся в почве
3) отдельные нити гриба, образующие плодовое тело
4) мочковатую корневую систему растения

6. К комплексным организмам относят:
1) лишайники
2) шляпочные грибы
3) водоросли
4) плесневые грибы
Почему они называются комплексными организмами?

7. Вставьте в текст «Сходство грибов с растениями и животными» пропущенные термины из предложенного перечня.

8. Верны ли следующие суждения о лишайниках?
A. Лишайники – это растительные организмы, утратившие способность к фотосинтезу.
B. Лишайники закрепляются на коре дерева с помощью тонких корней.
1) Верно только A;
2) Верно только B;
3) Верны оба суждения;
4) Оба суждения не верны.

9. Верны ли следующие суждения о лишайниках?
A. Тело лишайника образовано гифами гриба и одноклеточными зелёными водорослями.
B. Размножаются лишайники кусочками слоевища.
1) Верно только A;
2) Верно только B;
3) Верны оба суждения;
4) Оба суждения не верны.

10. Становите соответствие
|  Признаки | Царства организмов  |
|  1) эукариоты | A) грибы  |
|  2) используют для выпечки хлеба | B) бактерии  |
|  3) одноклеточные и многоклеточные |   |
|  4) в клетке одна хромосома |   |

11. ВИРУСЫ
Вирусы - _____________ формы жизни, проявляющие некоторые признаки живых организмов только внутри других клеток.

12. Выберите верные суждения.
1) Вирусы размножаются за счёт ресурсов клетки-хозяина.
2) Вирусы — это микроскопические одноклеточные организмы.
3) Клеточная стенка бактерий образована целлюлозой (клетчаткой).
4) Вирус ВИЧ вызывает у человека синдром приобретённого иммунного дефицита.`;

async function testUpload() {
  console.log('🧪 Testing Upload API Endpoint\n');
  console.log('='.repeat(60));
  
  // Create temporary test file
  const testFilePath = './test-input.txt';
  fs.writeFileSync(testFilePath, testContent, 'utf8');
  
  console.log('\n📋 Configuration:');
  console.log('Server:', 'http://localhost:3000');
  console.log('Provider:', process.env.LLM_PROVIDER || 'not set');
  console.log('API Key:', process.env.GROQ_API_KEY ? '✓ Set' : '✗ Not set');
  
  console.log('\n📄 Test File:');
  console.log(`File: ${testFilePath}`);
  console.log(`Size: ${fs.statSync(testFilePath).size} bytes`);
  console.log(`Content: Russian biology test (Fungi, Lichens, Viruses, Bacteria)`);
  
  console.log('\n🔄 Uploading file and extracting questions...');
  console.log('This may take 15-45 seconds...\n');
  
  const startTime = Date.now();
  
  try {
    // Create form data
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath), {
      filename: 'test-input.txt',
      contentType: 'text/plain'
    });
    
    // Make request
    const response = await fetch('http://localhost:3000/api/upload', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('✅ Upload and extraction successful!\n');
    console.log('='.repeat(60));
    console.log(`\n📊 Results:`);
    console.log(`⏱️  Processing time: ${duration} seconds`);
    console.log(`🔗 Share Link: ${result.shareLink}`);
    const questionCount = result.questionCount || result.questionsCount || result.questions?.length || 0;
    console.log(`📝 Questions extracted: ${questionCount}\n`);
    
    // Fetch the actual questions from the file endpoint
    console.log('📥 Fetching extracted questions...\n');
    try {
      const fileResponse = await fetch(result.fileUrl || `http://localhost:3000/api/file/${result.shareLink}`);
      const fileData = await fileResponse.json();
      
      if (fileData.questions && fileData.questions.length > 0) {
        console.log('📋 Extracted Questions:\n');
        fileData.questions.slice(0, 8).forEach((q, index) => {
          console.log(`${index + 1}. [${q.questionType?.toUpperCase() || 'UNKNOWN'}]`);
          const qText = q.questionText || '';
          console.log(`   ${qText.substring(0, 70)}${qText.length > 70 ? '...' : ''}`);
          if (q.options && q.options.length > 0) {
            console.log(`   Options: ${q.options.length} (${q.options.slice(0, 2).map(o => o.substring(0, 30)).join(', ')}...)`);
          }
          if (q.questionType === 'matching') {
            console.log(`   Matching: ${q.leftColumn?.length || 0} ↔ ${q.rightColumn?.length || 0} items`);
          }
          if (q.questionType === 'fill_blank') {
            console.log(`   Fill in the blank`);
          }
          console.log('');
        });
        
        if (fileData.questions.length > 8) {
          console.log(`   ... and ${fileData.questions.length - 8} more questions\n`);
        }
      }
    } catch (fetchError) {
      console.log('⚠️  Could not fetch questions details (this is okay)');
    }
    
    if (result.questions && result.questions.length > 0) {
      console.log('📋 Extracted Questions:\n');
      result.questions.slice(0, 5).forEach((q, index) => {
        console.log(`${index + 1}. [${q.questionType?.toUpperCase() || 'UNKNOWN'}]`);
        console.log(`   ${q.questionText?.substring(0, 80) || 'No question text'}${q.questionText?.length > 80 ? '...' : ''}`);
        if (q.options && q.options.length > 0) {
          console.log(`   Options: ${q.options.length}`);
        }
        console.log('');
      });
      
      if (result.questions.length > 5) {
        console.log(`   ... and ${result.questions.length - 5} more questions\n`);
      }
    }
    
    console.log('='.repeat(60));
    console.log('\n✅ Test completed successfully!');
    console.log(`\n📈 Summary:`);
    console.log(`   - Questions extracted: ${questionCount}`);
    console.log(`   - Processing time: ${duration}s`);
    console.log(`   - Average time per question: ${questionCount > 0 ? (duration / questionCount).toFixed(2) : 'N/A'}s`);
    console.log(`   - Share link: ${result.shareableUrl || `http://localhost:3000/test/${result.shareLink}`}`);
    console.log(`   - Test link: http://localhost:3000/test/${result.shareLink}`);
    
    // Cleanup
    fs.unlinkSync(testFilePath);
    
    process.exit(0);
    
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.error('\n❌ Test failed!\n');
    console.error('Error:', error.message);
    console.error(`\n⏱️  Failed after: ${duration} seconds`);
    
    // Cleanup
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
    
    process.exit(1);
  }
}

testUpload();

