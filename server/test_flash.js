require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function test() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log(result.response.text());
    } catch (error) {
        console.log("ERROR_MESSAGE_START");
        console.log(error.message.substring(0, 200)); // Print only first 200 chars
        console.log("ERROR_MESSAGE_END");
    }
}
test();
