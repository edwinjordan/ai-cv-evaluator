import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateCVPDF() {
    try {
        console.log('🔄 Starting CV PDF generation...');
        
        // Read the markdown content
        const markdownPath = path.join(__dirname, '..', 'sample-documents', 'CV_Sample.txt');
        const markdownContent = fs.readFileSync(markdownPath, 'utf8');
        
        console.log('📖 CV markdown content loaded');
        
        // Convert markdown to HTML
        const htmlContent = marked(markdownContent);
        
        // Create full HTML document with professional CV CSS styling
        const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sarah Johnson - Senior Full-Stack Developer CV</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.5;
            color: #333;
            background: white;
            font-size: 11pt;
        }
        
        .container {
            max-width: 210mm;
            margin: 0 auto;
            padding: 15mm;
            background: white;
        }
        
        /* Header Styling */
        h1 {
            color: #2c3e50;
            font-size: 28pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 5pt;
            letter-spacing: 1px;
        }
        
        h2 {
            color: #34495e;
            font-size: 14pt;
            text-align: center;
            margin-bottom: 15pt;
            font-weight: normal;
            font-style: italic;
        }
        
        h3 {
            color: #2980b9;
            font-size: 13pt;
            margin-top: 20pt;
            margin-bottom: 8pt;
            border-bottom: 2px solid #3498db;
            padding-bottom: 3pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        h4 {
            color: #2c3e50;
            font-size: 12pt;
            margin-top: 12pt;
            margin-bottom: 6pt;
            font-weight: bold;
        }
        
        h5 {
            color: #34495e;
            font-size: 11pt;
            margin-top: 10pt;
            margin-bottom: 4pt;
            font-weight: bold;
        }
        
        /* Contact Information */
        .contact-info {
            text-align: center;
            margin-bottom: 20pt;
            padding: 10pt;
            background-color: #f8f9fa;
            border-radius: 5pt;
        }
        
        .contact-info p {
            margin: 2pt 0;
            font-size: 10pt;
        }
        
        /* Paragraphs and Text */
        p {
            margin-bottom: 8pt;
            text-align: justify;
            line-height: 1.4;
        }
        
        /* Lists */
        ul, ol {
            padding-left: 15pt;
            margin-bottom: 10pt;
        }
        
        li {
            margin-bottom: 3pt;
            line-height: 1.3;
        }
        
        /* Experience Section */
        .job-title {
            font-weight: bold;
            color: #2c3e50;
            font-size: 12pt;
        }
        
        .company {
            color: #3498db;
            font-weight: bold;
        }
        
        .duration {
            color: #7f8c8d;
            font-style: italic;
            font-size: 10pt;
        }
        
        /* Skills Section */
        .skills-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10pt;
            margin: 10pt 0;
        }
        
        .skill-category {
            background-color: #f8f9fa;
            padding: 8pt;
            border-radius: 3pt;
            border-left: 3pt solid #3498db;
        }
        
        /* Code Styling */
        code {
            background-color: #f1f2f6;
            padding: 1pt 3pt;
            border-radius: 2pt;
            font-family: 'Courier New', monospace;
            font-size: 9pt;
            color: #2c3e50;
        }
        
        pre {
            background-color: #f8f9fa;
            border: 1pt solid #e9ecef;
            border-radius: 3pt;
            padding: 10pt;
            overflow-x: auto;
            margin: 8pt 0;
            font-size: 9pt;
            line-height: 1.3;
        }
        
        pre code {
            background: none;
            padding: 0;
            border-radius: 0;
        }
        
        /* Strong Text */
        strong {
            color: #2c3e50;
            font-weight: bold;
        }
        
        /* Links */
        a {
            color: #3498db;
            text-decoration: none;
        }
        
        /* Horizontal Rules */
        hr {
            border: none;
            height: 1pt;
            background-color: #bdc3c7;
            margin: 15pt 0;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 10pt 0;
            font-size: 10pt;
        }
        
        th, td {
            border: 1pt solid #ddd;
            padding: 6pt;
            text-align: left;
            vertical-align: top;
        }
        
        th {
            background-color: #3498db;
            color: white;
            font-weight: bold;
        }
        
        /* Blockquotes */
        blockquote {
            border-left: 3pt solid #3498db;
            margin: 10pt 0;
            padding: 5pt 15pt;
            background-color: #f8f9fa;
            font-style: italic;
        }
        
        /* Professional Highlights */
        .highlight {
            background-color: #e8f5e8;
            border-left: 4pt solid #27ae60;
            padding: 8pt;
            margin: 8pt 0;
            border-radius: 3pt;
        }
        
        .achievement {
            color: #27ae60;
            font-weight: bold;
        }
        
        .tech-stack {
            background-color: #e3f2fd;
            padding: 5pt;
            border-radius: 3pt;
            font-size: 10pt;
            margin: 5pt 0;
        }
        
        /* Print Specific Styles */
        @media print {
            .container {
                padding: 10mm;
            }
            
            body {
                font-size: 10pt;
                line-height: 1.3;
            }
            
            h1 {
                font-size: 22pt;
            }
            
            h2 {
                font-size: 12pt;
            }
            
            h3 {
                font-size: 11pt;
                page-break-after: avoid;
            }
            
            h4, h5 {
                page-break-after: avoid;
            }
            
            .job-title, .company {
                page-break-after: avoid;
            }
            
            ul, ol {
                page-break-inside: avoid;
            }
            
            pre {
                page-break-inside: avoid;
                font-size: 8pt;
            }
            
            .skills-grid {
                page-break-inside: avoid;
            }
            
            .highlight, .tech-stack {
                page-break-inside: avoid;
            }
        }
        
        /* Two-column layout for skills */
        .two-column {
            columns: 2;
            column-gap: 20pt;
            column-rule: 1pt solid #ecf0f1;
        }
        
        .two-column h4 {
            break-after: avoid;
        }
        
        .two-column ul {
            break-inside: avoid;
            margin-bottom: 15pt;
        }
        
        /* Section spacing */
        .section {
            margin-bottom: 20pt;
        }
        
        .subsection {
            margin-bottom: 15pt;
        }
        
        /* Professional Summary Box */
        .summary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15pt;
            border-radius: 5pt;
            margin: 15pt 0;
        }
        
        .summary h3 {
            color: white;
            border-bottom: 2pt solid rgba(255,255,255,0.3);
            margin-top: 0;
        }
        
        .summary strong {
            color: #f1c40f;
        }
        
        /* Footer */
        .footer {
            margin-top: 30pt;
            padding-top: 15pt;
            border-top: 2pt solid #ecf0f1;
            text-align: center;
            color: #7f8c8d;
            font-size: 10pt;
        }
    </style>
</head>
<body>
    <div class="container">
        ${htmlContent}
        
        <div class="footer">
            <p><em>CV generated on ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })}</em></p>
            <p>AI CV Evaluator - Sample CV Document</p>
        </div>
    </div>
</body>
</html>
        `;
        
        console.log('🎨 HTML content generated with professional CV styling');
        
        // Launch Puppeteer
        console.log('🚀 Launching browser...');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Set content
        await page.setContent(fullHTML, {
            waitUntil: 'networkidle0'
        });
        
        console.log('📄 CV content loaded in browser');
        
        // Generate PDF
        const pdfPath = path.join(__dirname, '..', 'sample-documents', 'CV_Sample.pdf');
        
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '15mm',
                right: '15mm',
                bottom: '15mm',
                left: '15mm'
            },
            preferCSSPageSize: true
        });
        
        await browser.close();
        
        console.log('✅ CV PDF generated successfully!');
        console.log(`📍 File location: ${pdfPath}`);
        
        // Check file size
        const stats = fs.statSync(pdfPath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 File size: ${fileSizeInMB} MB`);
        
        return pdfPath;
        
    } catch (error) {
        console.error('❌ Error generating CV PDF:', error);
        throw error;
    }
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateCVPDF()
        .then((pdfPath) => {
            console.log('\n🎉 CV PDF generation completed successfully!');
            console.log(`File saved at: ${pdfPath}`);
        })
        .catch((error) => {
            console.error('\n💥 Failed to generate CV PDF:', error.message);
            process.exit(1);
        });
}

export { generateCVPDF };