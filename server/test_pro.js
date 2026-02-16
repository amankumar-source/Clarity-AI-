require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Hello");
        console.log("SUCCESS_PRO");
        console.log(result.response.text());
    } catch (error) {
        console.log("ERROR_PRO");
        console.log(error.message.substring(0, 200));
    }
}
test();
