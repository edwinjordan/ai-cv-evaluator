import { generateProjectReportPDF } from './generatePDF.js';
import { generateCVPDF } from './generateCV_PDF.js';

async function generateAllSampleDocuments() {
    try {
        console.log('🚀 Starting generation of all sample documents...\n');
        
        // Generate Project Report PDF
        console.log('📊 Generating Project Report PDF...');
        const projectReportPath = await generateProjectReportPDF();
        console.log(`✅ Project Report PDF completed: ${projectReportPath}\n`);
        
        // Generate CV PDF  
        console.log('👤 Generating CV PDF...');
        const cvPath = await generateCVPDF();
        console.log(`✅ CV PDF completed: ${cvPath}\n`);
        
        console.log('🎉 All sample documents generated successfully!');
        console.log('\n📁 Generated files:');
        console.log(`  1. Project Report: ${projectReportPath}`);
        console.log(`  2. CV Document: ${cvPath}`);
        
        return {
            projectReport: projectReportPath,
            cv: cvPath
        };
        
    } catch (error) {
        console.error('❌ Error generating sample documents:', error);
        throw error;
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    generateAllSampleDocuments()
        .then((files) => {
            console.log('\n🏆 Sample document generation completed successfully!');
            console.log('Files are ready for AI CV Evaluator testing.');
        })
        .catch((error) => {
            console.error('\n💥 Failed to generate sample documents:', error.message);
            process.exit(1);
        });
}

export { generateAllSampleDocuments };