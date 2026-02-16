require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log(result.response.text());
    } catch (error) {
        console.log("FULL_ERROR_START");
        console.log(JSON.stringify(error, null, 2));
        console.log(error.message);
        if (error.response) {
            console.log("Response data:", JSON.stringify(error.response, null, 2));
        }
        console.log("FULL_ERROR_END");
    }
}
test();
