/**
 * Installation Guide Button Test
 * 
 * This test verifies that the Installation Guide button's modal is accessible
 * to all users by ensuring it's not nested within the personal-questions-section.
 */

const fs = require('fs');
const path = require('path');

describe('Installation Guide Button', () => {
    let hostedIndexContent;
    
    beforeAll(() => {
        const hostedIndexPath = path.join(__dirname, '../../core/views/hosted-index.ejs');
        hostedIndexContent = fs.readFileSync(hostedIndexPath, 'utf-8');
    });
    
    test('should have installation instructions modal in the template', () => {
        expect(hostedIndexContent).toContain('id="install-instructions-modal"');
    });
    
    test('should have showInstallInstructions function', () => {
        expect(hostedIndexContent).toContain('function showInstallInstructions()');
    });
    
    test('should have closeInstallInstructions function', () => {
        expect(hostedIndexContent).toContain('function closeInstallInstructions()');
    });
    
    test('should have Installation Guide button that calls showInstallInstructions', () => {
        expect(hostedIndexContent).toContain('onclick="showInstallInstructions()"');
    });
    
    test('modal should appear BEFORE personal-questions-section in the DOM', () => {
        const modalIndex = hostedIndexContent.indexOf('id="install-instructions-modal"');
        const personalSectionIndex = hostedIndexContent.indexOf('id="personal-questions-section"');
        
        expect(modalIndex).toBeGreaterThan(-1);
        expect(personalSectionIndex).toBeGreaterThan(-1);
        expect(modalIndex).toBeLessThan(personalSectionIndex);
    });
    
    test('modal should NOT be nested inside personal-questions-section', () => {
        // Extract the personal-questions-section content
        const personalSectionStart = hostedIndexContent.indexOf('<div id="personal-questions-section"');
        const personalSectionEnd = hostedIndexContent.indexOf('</div>', 
            hostedIndexContent.indexOf('<!-- AI Models Configuration Page -->', personalSectionStart));
        
        const personalSectionContent = hostedIndexContent.substring(personalSectionStart, personalSectionEnd);
        
        // Verify the modal is NOT within this section
        expect(personalSectionContent).not.toContain('id="install-instructions-modal"');
    });
    
    test('modal should be positioned after offline-version-section', () => {
        const offlineSectionIndex = hostedIndexContent.indexOf('id="offline-version-section"');
        const modalIndex = hostedIndexContent.indexOf('id="install-instructions-modal"');
        
        expect(offlineSectionIndex).toBeGreaterThan(-1);
        expect(modalIndex).toBeGreaterThan(-1);
        expect(modalIndex).toBeGreaterThan(offlineSectionIndex);
    });
    
    test('should have proper modal structure with content', () => {
        expect(hostedIndexContent).toContain('Offline Version Installation Guide');
        expect(hostedIndexContent).toContain('System Requirements');
        expect(hostedIndexContent).toContain('Quick Installation');
        expect(hostedIndexContent).toContain('After Installation');
    });
    
    test('should have Close button in modal', () => {
        const modalStart = hostedIndexContent.indexOf('id="install-instructions-modal"');
        const modalEnd = hostedIndexContent.indexOf('</div>', 
            hostedIndexContent.indexOf('schedule-modal-actions', modalStart) + 200);
        const modalContent = hostedIndexContent.substring(modalStart, modalEnd);
        
        expect(modalContent).toContain('onclick="closeInstallInstructions()"');
    });
});
