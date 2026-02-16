require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const key = process.env.GEMINI_API_KEY;
console.log(`Key length: ${key ? key.length : 'undefined'}`);
if (key) {
    console.log(`Key start: ${key.substring(0, 5)}`);
    console.log(`Key end: ${key.substring(key.length - 5)}`);
    console.log(`Key char at 20: ${key.charCodeAt(20)}`); // check for hidden chars
}

async function test() {
    const genAI = new GoogleGenerativeAI(key);
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Model requested: gemini-1.5-flash");
        await model.generateContent("test");
        console.log("Success");
    } catch (e) {
        console.log("Error: " + e.message.substring(0, 100)); // Print start of error
    }
}
test();
