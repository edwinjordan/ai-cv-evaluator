import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { marked } from 'marked';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateProjectReportPDF() {
    try {
        console.log('🔄 Starting PDF generation...');
        
        // Read the markdown content
        const markdownPath = path.join(__dirname, '..', 'sample-documents', 'Project_Report_Sample.txt');
        const markdownContent = fs.readFileSync(markdownPath, 'utf8');
        
        console.log('📖 Markdown content loaded');
        
        // Convert markdown to HTML
        const htmlContent = marked(markdownContent);
        
        // Create full HTML document with CSS styling
        const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>E-Commerce Platform Development - Project Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: white;
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 30px;
            font-size: 2.2em;
        }
        
        h2 {
            color: #34495e;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
            margin-top: 40px;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        
        h3 {
            color: #2980b9;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 1.2em;
        }
        
        p {
            margin-bottom: 15px;
            text-align: justify;
        }
        
        strong {
            color: #2c3e50;
        }
        
        ul, ol {
            padding-left: 20px;
            margin-bottom: 20px;
        }
        
        li {
            margin-bottom: 8px;
        }
        
        code {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 2px 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        
        pre {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        pre code {
            background: none;
            border: none;
            padding: 0;
            font-size: 0.85em;
            line-height: 1.4;
        }
        
        blockquote {
            border-left: 4px solid #3498db;
            margin: 20px 0;
            padding: 10px 20px;
            background-color: #f8f9fa;
            font-style: italic;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        
        th {
            background-color: #3498db;
            color: white;
        }
        
        .highlight {
            background-color: #fff3cd;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
            margin: 20px 0;
        }
        
        .success {
            color: #27ae60;
            font-weight: bold;
        }
        
        .metrics {
            background-color: #e8f5e8;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }
        
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #ecf0f1;
            text-align: center;
            color: #7f8c8d;
        }
        
        hr {
            border: none;
            height: 2px;
            background-color: #ecf0f1;
            margin: 30px 0;
        }
        
        @media print {
            body {
                font-size: 11pt;
                line-height: 1.4;
            }
            
            h1 {
                font-size: 18pt;
            }
            
            h2 {
                font-size: 14pt;
                page-break-after: avoid;
            }
            
            h3 {
                font-size: 12pt;
                page-break-after: avoid;
            }
            
            pre {
                font-size: 9pt;
                page-break-inside: avoid;
            }
            
            .page-break {
                page-break-before: always;
            }
        }
    </style>
</head>
<body>
    ${htmlContent}
    
    <div class="footer">
        <p><em>Generated on ${new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        })}</em></p>
        <p>AI CV Evaluator - Sample Project Report</p>
    </div>
</body>
</html>
        `;
        
        console.log('🎨 HTML content generated with styling');
        
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
        
        console.log('📄 Content loaded in browser');
        
        // Generate PDF
        const pdfPath = path.join(__dirname, '..', 'sample-documents', 'Project_Report_Sample.pdf');
        
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });
        
        await browser.close();
        
        console.log('✅ PDF generated successfully!');
        console.log(`📍 File location: ${pdfPath}`);
        
        // Check file size
        const stats = fs.statSync(pdfPath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        console.log(`📊 File size: ${fileSizeInMB} MB`);
        
        return pdfPath;
        
    } catch (error) {
        console.error('❌ Error generating PDF:', error);
        throw error;
    }
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateProjectReportPDF()
        .then((pdfPath) => {
            console.log('\n🎉 PDF generation completed successfully!');
            console.log(`File saved at: ${pdfPath}`);
        })
        .catch((error) => {
            console.error('\n💥 Failed to generate PDF:', error.message);
            process.exit(1);
        });
}

export { generateProjectReportPDF };