import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import { VITAsset, VITInspectionChecklist, SubstationInspection, Region, District } from "@/lib/types";
import { formatDate } from "@/utils/calculations";
import { format } from 'date-fns';

// Add type declaration for jsPDF with autotable extensions
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable?: {
      finalY?: number;
    };
    autoTable: (options: any) => jsPDF;
    internal: {
      events: PubSub;
      scaleFactor: number;
      pageSize: {
        width: number;
        getWidth: () => number;
        height: number;
        getHeight: () => number;
      };
      pages: number[];
      getEncryptor: (objectId: number) => (data: string) => string;
    };
    setPage: (pageNumber: number) => jsPDF;
  }
}

/**
 * Export VIT inspection data to CSV format
 */
export const exportInspectionToCsv = (inspection: VITInspectionChecklist, asset: VITAsset | null, getRegionName: (id: string) => string, getDistrictName: (id: string) => string) => {
  if (!asset) return;

  // Create headers and data as single rows
  const headers = [
    "Asset Serial Number",
    "Asset Type",
    "Region",
    "District",
    "Inspection Date",
    "Inspector",
    "Rodent/Termite Encroachment",
    "Clean & Dust Free",
    "Protection Button Enabled",
    "Recloser Button Enabled",
    "Ground/Earth Button Enabled",
    "AC Power On",
    "Battery Power Low",
    "Handle Lock On",
    "Remote Button Enabled",
    "Gas Level Low",
    "Earthing Arrangement Adequate",
    "No Fuses Blown",
    "No Damage to Bushings",
    "No Damage to HV Connections",
    "Insulators Clean",
    "Paintwork Adequate",
    "PT Fuse Link Intact",
    "No Corrosion",
    "Silica Gel Condition",
    "Correct Labelling",
    "Remarks"
  ];

  const data = [
    asset?.serialNumber || "",
    asset?.typeOfUnit || "",
    asset?.region || "Unknown",
    asset?.district || "Unknown",
    formatDate(inspection.inspectionDate),
    inspection.inspectedBy,
    inspection.rodentTermiteEncroachment,
    inspection.cleanDustFree,
    inspection.protectionButtonEnabled,
    inspection.recloserButtonEnabled,
    inspection.groundEarthButtonEnabled,
    inspection.acPowerOn,
    inspection.batteryPowerLow,
    inspection.handleLockOn,
    inspection.remoteButtonEnabled,
    inspection.gasLevelLow,
    inspection.earthingArrangementAdequate,
    inspection.noFusesBlown,
    inspection.noDamageToBushings,
    inspection.noDamageToHVConnections,
    inspection.insulatorsClean,
    inspection.paintworkAdequate,
    inspection.ptFuseLinkIntact,
    inspection.noCorrosion,
    inspection.silicaGelCondition,
    inspection.correctLabelling,
    inspection.remarks
  ];

  // Combine headers and data
  const csvContent = [
    headers.join(","),
    data.map(v => `"${v}"`).join(",")
  ].join("\n");

  // Create and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `vit-inspection-${asset?.serialNumber}-${inspection.inspectionDate.split('T')[0]}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generate comprehensive PDF report for VIT inspection
 */
export const exportInspectionToPDF = async (inspection: VITInspectionChecklist, asset: VITAsset | null, getRegionName: (id: string) => string, getDistrictName: (id: string) => string) => {
  try {
    if (!asset) {
      throw new Error("Asset information is required to generate the report");
    }

    const region = asset.region || "Unknown";
    const district = asset.district || "Unknown";
    
    // Create PDF document with A4 size
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    const { width, height } = page.getSize();

    // Add header with company logo and title
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    page.drawText('VIT INSPECTION REPORT', {
      x: 50,
      y: height - 50,
      size: 24,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });

    // Add report metadata
    let formattedDate = 'Not specified';
    try {
      if (inspection.inspectionDate) {
        const dateObj = new Date(inspection.inspectionDate);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = format(dateObj, 'dd/MM/yyyy');
        }
      }
    } catch (error) {
      console.warn('Error formatting inspection date:', error);
    }

    page.drawText(`Report Date: ${formattedDate}`, {
      x: 50,
      y: height - 80,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawText(`Inspector: ${inspection.inspectedBy || 'Not specified'}`, {
      x: 50,
      y: height - 100,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
    });

    // Add asset information section
    page.drawText('Asset Information', {
      x: 50,
      y: height - 150,
      size: 16,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });

    // Draw asset info table
    const assetInfo = [
      ['Serial Number', asset.serialNumber || 'Not specified'],
      ['Type of Unit', asset.typeOfUnit || 'Not specified'],
      ['Voltage Level', asset.voltageLevel || 'Not specified'],
      ['Region', region],
      ['District', district],
      ['Location', asset.location || 'Not specified'],
      ['Status', asset.status || 'Not specified'],
    ];

    let y = height - 180;
    assetInfo.forEach(([label, value]) => {
      page.drawText(`${label}:`, {
        x: 50,
        y,
        size: 12,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText(value, {
        x: 200,
        y,
        size: 12,
        color: rgb(0, 0, 0),
      });
      y -= 20;
    });

    // Add inspection summary
    page.drawText('Inspection Summary', {
      x: 50,
      y: y - 30,
      size: 16,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });

    // Calculate summary statistics
    const inspectionItems = [
      { name: 'Rodent/Termite Encroachment', status: inspection.rodentTermiteEncroachment || 'Not specified' },
      { name: 'Clean and Dust Free', status: inspection.cleanDustFree || 'Not specified' },
      { name: 'Protection Button Enabled', status: inspection.protectionButtonEnabled || 'Not specified' },
      { name: 'Recloser Button Enabled', status: inspection.recloserButtonEnabled || 'Not specified' },
      { name: 'Ground/Earth Button Enabled', status: inspection.groundEarthButtonEnabled || 'Not specified' },
      { name: 'AC Power On', status: inspection.acPowerOn || 'Not specified' },
      { name: 'Battery Power Low', status: inspection.batteryPowerLow || 'Not specified' },
      { name: 'Handle Lock On', status: inspection.handleLockOn || 'Not specified' },
      { name: 'Remote Button Enabled', status: inspection.remoteButtonEnabled || 'Not specified' },
      { name: 'Gas Level Low', status: inspection.gasLevelLow || 'Not specified' },
      { name: 'Earthing Arrangement Adequate', status: inspection.earthingArrangementAdequate || 'Not specified' },
      { name: 'No Fuses Blown', status: inspection.noFusesBlown || 'Not specified' },
      { name: 'No Damage to Bushings', status: inspection.noDamageToBushings || 'Not specified' },
      { name: 'No Damage to HV Connections', status: inspection.noDamageToHVConnections || 'Not specified' },
      { name: 'Insulators Clean', status: inspection.insulatorsClean || 'Not specified' },
      { name: 'Paintwork Adequate', status: inspection.paintworkAdequate || 'Not specified' },
      { name: 'PT Fuse Link Intact', status: inspection.ptFuseLinkIntact || 'Not specified' },
      { name: 'No Corrosion', status: inspection.noCorrosion || 'Not specified' },
      { name: 'Silica Gel Condition', status: inspection.silicaGelCondition || 'Not specified' },
      { name: 'Correct Labelling', status: inspection.correctLabelling || 'Not specified' },
    ];

    const totalItems = inspectionItems.length;
    const goodItems = inspectionItems.filter(item => item.status === 'Yes' || item.status === 'Good').length;
    const badItems = totalItems - goodItems;
    const goodPercentage = ((goodItems / totalItems) * 100).toFixed(1);

    const summaryInfo = [
      ['Total Items Inspected', totalItems.toString()],
      ['Items in Good Condition', `${goodItems} (${goodPercentage}%)`],
      ['Items Requiring Attention', badItems.toString()],
    ];

    y -= 60;
    summaryInfo.forEach(([label, value]) => {
      page.drawText(`${label}:`, {
        x: 50,
        y,
        size: 12,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawText(value, {
        x: 200,
        y,
        size: 12,
        color: rgb(0, 0, 0),
      });
      y -= 20;
    });

    // Add detailed inspection results
    const resultsPage = pdfDoc.addPage([595.28, 841.89]);
    resultsPage.drawText('Detailed Inspection Results', {
      x: 50,
      y: height - 50,
      size: 16,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });

    // Draw inspection items table
    y = height - 80;
    inspectionItems.forEach((item, index) => {
      if (y < 100) {
        // Add new page if running out of space
        const newPage = pdfDoc.addPage([595.28, 841.89]);
        y = height - 50;
        resultsPage.drawText('Detailed Inspection Results (Continued)', {
          x: 50,
          y,
          size: 16,
          color: rgb(0, 0.2, 0.4),
          font: boldFont,
        });
        y -= 30;
      }

      // Draw item details
      resultsPage.drawText(`${index + 1}. ${item.name}`, {
        x: 50,
        y,
        size: 12,
        color: rgb(0, 0, 0),
      });

      const statusText = item.status === 'Yes' || item.status === 'Good' ? '[OK] Good' : '[X] Requires Attention';
      const statusColor = item.status === 'Yes' || item.status === 'Good' ? rgb(0, 0.5, 0) : rgb(0.8, 0, 0);

      resultsPage.drawText(`Status: ${statusText}`, {
        x: 300,
        y,
        size: 12,
        color: statusColor,
      });

      y -= 30;
    });

    // Add remarks if any
    if (inspection.remarks) {
      const remarksPage = pdfDoc.addPage([595.28, 841.89]);
      remarksPage.drawText('Additional Remarks', {
        x: 50,
        y: height - 50,
        size: 16,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });

      remarksPage.drawText(inspection.remarks, {
        x: 50,
        y: height - 100,
        size: 12,
        color: rgb(0.3, 0.3, 0.3),
        maxWidth: width - 100,
      });
    }

    // Add footer with page numbers
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: width - 100,
        y: 30,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Generate filename with safe date handling
    let filenameDate = 'unknown-date';
    try {
      if (inspection.inspectionDate) {
        const dateObj = new Date(inspection.inspectionDate);
        if (!isNaN(dateObj.getTime())) {
          filenameDate = format(dateObj, 'yyyy-MM-dd');
        }
      }
    } catch (error) {
      console.warn('Error formatting filename date:', error);
    }
    
    link.href = url;
    link.download = `vit-inspection-${asset.serialNumber}-${filenameDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

/**
 * Generate comprehensive PDF report for Substation inspection
 */
export const exportSubstationInspectionToPDF = async (inspection: SubstationInspection) => {
  try {
    console.log('Starting PDF generation for inspection:', inspection.id);
    
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    
    // Load fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Define layout constants
    const { width, height } = page.getSize();
    const margin = 50;
    const lineHeight = 20;
    const sectionSpacing = 30;
    
    let currentY = height - margin;
    
    // Add header
    page.drawText('SUBSTATION INSPECTION REPORT', {
      x: margin,
      y: currentY,
      size: 24,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });
    currentY -= lineHeight * 2;

    // Add report metadata with safe date handling
    let formattedDate = 'Not specified';
    try {
      if (inspection.date) {
        const dateObj = new Date(inspection.date);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = format(dateObj, 'dd/MM/yyyy');
        }
      }
    } catch (error) {
      console.warn('Error formatting inspection date:', error);
    }

    page.drawText(`Report Date: ${formattedDate}`, {
      x: margin,
      y: currentY,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
      font: regularFont,
    });
    currentY -= lineHeight;

    page.drawText(`Created By: ${inspection.createdBy || 'Not specified'}`, {
      x: margin,
      y: currentY,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
      font: regularFont,
    });
    currentY -= lineHeight;

    // Add substation information
    page.drawText('Substation Information:', {
      x: margin,
      y: currentY,
      size: 14,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });
    currentY -= lineHeight;

    const substationInfo = [
      ['Substation No', inspection.substationNo],
      ['Region', inspection.region],
      ['District', inspection.district],
      ['Type', inspection.type],
      ['Location', inspection.location || 'Not specified'],
      ['Voltage Level', inspection.voltageLevel || 'Not specified'],
      ['Status', inspection.status || 'Not specified'],
    ];

    substationInfo.forEach(([label, value]) => {
      page.drawText(`${label}: ${value}`, {
        x: margin,
        y: currentY,
        size: 12,
        color: rgb(0.2, 0.2, 0.2),
        font: regularFont,
      });
      currentY -= lineHeight;
    });

    // Add inspection details
    currentY -= sectionSpacing;
    page.drawText('Inspection Details:', {
      x: margin,
      y: currentY,
      size: 14,
      color: rgb(0, 0.2, 0.4),
      font: boldFont,
    });
    currentY -= lineHeight;

    // Group items by category
    const categories = [
      { 
        title: 'General Building Information', 
        key: 'general building',
        description: 'This section covers the general condition and maintenance of the substation building.'
      },
      { 
        title: 'Control Equipment', 
        key: 'control equipment',
        description: 'This section covers the inspection of control panels, relays, and other control equipment.'
      },
      { 
        title: 'Power Transformer', 
        key: 'power transformer',
        description: 'This section covers the inspection of transformers, cooling systems, and related equipment.'
      },
      { 
        title: 'Outdoor Equipment', 
        key: 'outdoor equipment',
        description: 'This section covers the inspection of outdoor equipment, switchgear, and related components.'
      },
      { 
        title: 'Site Condition', 
        key: 'site condition',
        description: 'This section covers the inspection of the substation site and surrounding area.'
      },
      { 
        title: 'Basement', 
        key: 'basement',
        description: 'This section covers the inspection of the substation basement and related equipment.'
      }
    ];

    let currentPage = page;

    categories.forEach(category => {
      // Check if we need a new page
      if (currentY < margin + lineHeight * 5) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - margin;
      }

      // Add section title
      currentY -= sectionSpacing;
      currentPage.drawText(category.title, {
        x: margin,
        y: currentY,
        size: 16,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight;

      // Add section description
      currentPage.drawText(category.description, {
        x: margin,
        y: currentY,
        size: 10,
        color: rgb(0.3, 0.3, 0.3),
        font: regularFont,
      });
      currentY -= lineHeight * 1.5;

      // Get items for this category
      const categoryItems = inspection.items?.filter(item => 
        item.category.toLowerCase() === category.key.toLowerCase()
      ) || [];

      if (categoryItems.length > 0) {
        categoryItems.forEach(item => {
          if (currentY < margin + lineHeight * 3) {
            currentPage = pdfDoc.addPage([595.28, 841.89]);
            currentY = height - margin;
          }

          // Draw item name
          currentPage.drawText(`• ${item.name}`, {
            x: margin,
            y: currentY,
            size: 12,
            color: rgb(0.2, 0.2, 0.2),
            font: regularFont,
          });

          // Draw status with color coding
          const statusText = item.status || 'Not specified';
          const statusColor = statusText.toLowerCase() === 'good' ? rgb(0, 0.5, 0) : 
                            statusText.toLowerCase() === 'bad' ? rgb(0.8, 0, 0) : 
                            rgb(0.5, 0.5, 0.5);

          currentPage.drawText(`Status: ${statusText}`, {
            x: width - margin - 150,
            y: currentY,
            size: 12,
            color: statusColor,
            font: regularFont,
          });

          currentY -= lineHeight;

          // Add remarks if available
          if (item.remarks) {
            if (currentY < margin + lineHeight * 3) {
              currentPage = pdfDoc.addPage([595.28, 841.89]);
              currentY = height - margin;
            }

            currentPage.drawText(`Remarks: ${item.remarks}`, {
              x: margin + 20,
              y: currentY,
              size: 10,
              color: rgb(0.3, 0.3, 0.3),
              font: regularFont,
            });
            currentY -= lineHeight;
          }

          currentY -= lineHeight * 0.5;
        });
      } else {
        currentPage.drawText('No items recorded for this section', {
          x: margin,
          y: currentY,
          size: 12,
          color: rgb(0.5, 0.5, 0.5),
          font: regularFont,
        });
        currentY -= lineHeight;
      }
    });

    // Add remarks if available
    if (inspection.remarks) {
      currentY -= sectionSpacing;
      if (currentY < margin + lineHeight * 3) {
        currentPage = pdfDoc.addPage([595.28, 841.89]);
        currentY = height - margin;
      }

      currentPage.drawText('Additional Notes:', {
        x: margin,
        y: currentY,
        size: 14,
        color: rgb(0, 0.2, 0.4),
        font: boldFont,
      });
      currentY -= lineHeight;

      const remarksLines = inspection.remarks.split('\n');
      remarksLines.forEach(line => {
        if (currentY < margin + lineHeight * 3) {
          currentPage = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - margin;
        }

        currentPage.drawText(line, {
          x: margin,
          y: currentY,
          size: 12,
          color: rgb(0.2, 0.2, 0.2),
          font: regularFont,
        });
        currentY -= lineHeight;
      });
    }

    // Add footer with page numbers
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      page.drawText(`Page ${index + 1} of ${pages.length}`, {
        x: width - margin - 50,
        y: margin - 20,
        size: 10,
        color: rgb(0.5, 0.5, 0.5),
        font: regularFont,
      });
    });

    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Generate filename with safe date handling
    let filenameDate = 'unknown-date';
    try {
      if (inspection.date) {
        const dateObj = new Date(inspection.date);
        if (!isNaN(dateObj.getTime())) {
          filenameDate = format(dateObj, 'yyyy-MM-dd');
        }
      }
    } catch (error) {
      console.warn('Error formatting filename date:', error);
    }
    
    link.href = url;
    link.download = `substation-inspection-${inspection.substationNo}-${filenameDate}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

/**
 * Generate comprehensive PDF report for Analytics & Reporting
 */
export const exportAnalyticsToPDF = async (
  filteredFaults: any[],
  reliabilityIndices: any,
  dateRange: string,
  startDate: Date | null,
  endDate: Date | null,
  selectedRegion: string,
  selectedDistrict: string,
  regions: Region[],
  districts: District[]
) => {
  try {
    // Create PDF document with A4 size
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
    const { width, height } = page.getSize();
    const margin = 50;
    const contentWidth = width - margin * 2;
    let currentY = height - margin;

    // Load fonts
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // --- Header --- 
    page.drawText('ANALYTICS & REPORTING', {
      x: margin,
      y: currentY,
      size: 18,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 25;

    // --- Metadata --- 
    const metaData = [
        [`Report Generated:`, format(new Date(), 'dd/MM/yyyy HH:mm')],
        [`Date Range:`, dateRange === 'all' ? 'All Time' : `${format(startDate!, 'dd/MM/yyyy')} to ${format(endDate!, 'dd/MM/yyyy')}`],
        [`Region:`, selectedRegion === 'all' ? 'All Regions' : regions.find(r => r.id === selectedRegion)?.name || 'Unknown'],
        [`District:`, selectedDistrict === 'all' ? 'All Districts' : districts.find(d => d.id === selectedDistrict)?.name || 'Unknown']
    ];
    metaData.forEach(([label, value]) => {
        page.drawText(label, { x: margin, y: currentY, font: regularFont, size: 10, color: rgb(0.3, 0.3, 0.3) });
        page.drawText(value, { x: margin + 100, y: currentY, font: regularFont, size: 10, color: rgb(0, 0, 0) });
        currentY -= 15;
    });
    currentY -= 15; // Extra space after metadata
    
    // --- Summary Statistics Table --- 
    page.drawText('Summary Statistics', {
      x: margin,
      y: currentY,
      size: 14,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 20;

    const totalFaults = filteredFaults.length;
    const op5Faults = filteredFaults.filter(f => 'faultLocation' in f).length;
    const controlOutages = filteredFaults.filter(f => 'customersAffected' in f).length;
    const activeFaults = filteredFaults.filter(f => f.status === 'active').length;
    const resolvedFaults = totalFaults - activeFaults; // Or filter for resolved status

    const summaryHeaders = ['Metric', 'Value'];
    const summaryData = [
      ['Total Faults / Outages', totalFaults],
      ['OP5 Faults', op5Faults],
      ['Control System Outages', controlOutages],
      ['Active', activeFaults],
      ['Resolved', resolvedFaults],
    ];

    currentY = await drawTable({ 
      page, startX: margin, startY: currentY, tableWidth: contentWidth / 2, // Use half width
      headers: summaryHeaders, data: summaryData, 
      headerFont: boldFont, bodyFont: regularFont, 
      columnWidths: [150, 100]
    });
    currentY -= 20; // Space after table

    // --- Reliability Indices Table --- 
     page.drawText('Reliability Indices', {
      x: margin,
      y: currentY,
      size: 14,
      font: boldFont,
      color: rgb(0, 0.2, 0.4),
    });
    currentY -= 20;

    const reliabilityHeaders = ['Population', 'SAIDI', 'SAIFI', 'CAIDI'];
    const reliabilityData = [
      ['Rural', 
        reliabilityIndices?.rural?.saidi?.toFixed(3) || '0.000', 
        reliabilityIndices?.rural?.saifi?.toFixed(3) || '0.000', 
        reliabilityIndices?.rural?.caidi?.toFixed(3) || '0.000'
      ],
       ['Urban', 
        reliabilityIndices?.urban?.saidi?.toFixed(3) || '0.000', 
        reliabilityIndices?.urban?.saifi?.toFixed(3) || '0.000', 
        reliabilityIndices?.urban?.caidi?.toFixed(3) || '0.000'
      ],
       ['Metro', 
        reliabilityIndices?.metro?.saidi?.toFixed(3) || '0.000', 
        reliabilityIndices?.metro?.saifi?.toFixed(3) || '0.000', 
        reliabilityIndices?.metro?.caidi?.toFixed(3) || '0.000'
      ],
      ['Total', // Add a total row if available in reliabilityIndices object
        reliabilityIndices?.total?.saidi?.toFixed(3) || 'N/A', 
        reliabilityIndices?.total?.saifi?.toFixed(3) || 'N/A', 
        reliabilityIndices?.total?.caidi?.toFixed(3) || 'N/A'
      ],
    ];

     currentY = await drawTable({ 
      page, startX: margin, startY: currentY, tableWidth: contentWidth, // Use full width
      headers: reliabilityHeaders, data: reliabilityData, 
      headerFont: boldFont, bodyFont: regularFont, 
      columnWidths: [100, 100, 100, 100] // Adjust widths as needed
    });
    currentY -= 20;

    // --- MTTR Report Table --- 
    const op5FaultsWithMTTR = filteredFaults.filter(f => 'faultLocation' in f && typeof f.mttr === 'number' && f.mttr > 0);
    
    if (op5FaultsWithMTTR.length > 0) {
         page.drawText('Mean Time To Repair (MTTR) - OP5 Faults', {
          x: margin,
          y: currentY,
          size: 14,
          font: boldFont,
          color: rgb(0, 0.2, 0.4),
        });
        currentY -= 20;

        const totalMTTR = op5FaultsWithMTTR.reduce((sum, fault) => sum + (fault.mttr || 0), 0);
        const averageMTTR = totalMTTR / op5FaultsWithMTTR.length;

        const mttrSummaryHeaders = ['Metric', 'Value'];
        const mttrSummaryData = [
            ['Faults with MTTR', op5FaultsWithMTTR.length],
            ['Average MTTR (All)', `${averageMTTR.toFixed(2)} hours`],
            ['Total Repair Time', `${totalMTTR.toFixed(2)} hours`],
        ];

        // Draw Summary MTTR Table first
        currentY = await drawTable({ 
            page, startX: margin, startY: currentY, tableWidth: contentWidth / 2, // Half width
            headers: mttrSummaryHeaders, data: mttrSummaryData, 
            headerFont: boldFont, bodyFont: regularFont, 
            columnWidths: [150, 100]
        });
        currentY -= 15; // Space after summary

        // MTTR by Region Table
         page.drawText('Average MTTR by Region', {
              x: margin,
              y: currentY,
              size: 12,
              font: boldFont,
              color: rgb(0, 0.2, 0.4),
         });
         currentY -= 15;

        const mttrRegionHeaders = ['Region', 'Avg. MTTR (hours)', 'Fault Count'];
        const mttrRegionData = regions
            .map(region => {
                const regionFaults = op5FaultsWithMTTR.filter(f => f.regionId === region.id);
                if (regionFaults.length === 0) return null; // Skip regions with no data
                const regionMTTRSum = regionFaults.reduce((sum, fault) => sum + (fault.mttr || 0), 0);
                const avgMTTR = regionMTTRSum / regionFaults.length;
                return [region.name, avgMTTR.toFixed(2), regionFaults.length];
            })
            .filter(row => row !== null); // Filter out null rows

         if (mttrRegionData.length > 0) {
             currentY = await drawTable({ 
                page, startX: margin, startY: currentY, tableWidth: contentWidth * 0.75, // 3/4 width
                headers: mttrRegionHeaders, data: mttrRegionData as (string | number)[][], 
                headerFont: boldFont, bodyFont: regularFont, 
                columnWidths: [150, 100, 100]
            });
         }
         currentY -= 20;
    }
    
    // TODO: Add Fault List Table (Optional, might need pagination)
    // Consider adding a table listing the top N faults or faults exceeding a certain duration/MTTR
    // This would require pagination logic if the list is long.

    // Add footer with page numbers (ensure this runs after all pages potentially added)
    const totalPages = pdfDoc.getPages().length;
    pdfDoc.getPages().forEach((p, index) => {
      p.drawText(`Page ${index + 1} of ${totalPages}`, {
        x: width - margin - 50,
        y: margin / 2, // Position at bottom margin
        size: 9,
        font: regularFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    });

    // --- Save the PDF --- 
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    let filenameDate = 'all-time';
    if (dateRange !== 'all' && startDate && endDate) {
      filenameDate = `${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}`;
    }
    link.href = url;
    link.download = `Analytics-Report-${filenameDate}.pdf`; // Improved filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Analytics PDF report generated successfully.');

  } catch (error) {
    console.error('Error generating analytics PDF report:', error);
    // Consider using toast notification for user feedback
    // toast.error("Failed to generate PDF report.");
  }
};

// Helper function to draw text and handle potential null/undefined values
const drawTextSafe = (page: PDFPage, text: string | number | null | undefined, options: any, fallback = 'N/A') => {
  const displayText = (text === null || text === undefined || text === '') ? fallback : String(text);
  page.drawText(displayText, options);
};

// --- NEW TABLE DRAWING HELPER --- 
interface DrawTableOptions {
  page: PDFPage;
  startX: number;
  startY: number;
  tableWidth: number;
  headers: string[];
  data: (string | number | null | undefined)[][]; // Array of rows, each row is an array of cell values
  columnWidths?: number[]; // Optional: specify widths, otherwise distribute equally
  headerFont: PDFFont;
  bodyFont: PDFFont;
  headerFontSize?: number;
  bodyFontSize?: number;
  lineHeight?: number;
  borderColor?: any; // e.g., rgb(0.8, 0.8, 0.8)
  headerBgColor?: any; // e.g., rgb(0.9, 0.9, 0.9)
  headerTextColor?: any;
  bodyTextColor?: any;
}

async function drawTable({
  page,
  startX,
  startY,
  tableWidth,
  headers,
  data,
  columnWidths,
  headerFont,
  bodyFont,
  headerFontSize = 10,
  bodyFontSize = 9,
  lineHeight = 15,
  borderColor = rgb(0.7, 0.7, 0.7),
  headerBgColor = rgb(0.9, 0.9, 0.9),
  headerTextColor = rgb(0, 0, 0),
  bodyTextColor = rgb(0, 0, 0),
}: DrawTableOptions): Promise<number> { // Returns the Y position after the table
  let currentY = startY;
  const columnCount = headers.length;
  const defaultColWidth = tableWidth / columnCount;
  const widths = columnWidths || Array(columnCount).fill(defaultColWidth);

  // Ensure widths array matches header count
  if (widths.length !== columnCount) {
    console.warn("drawTable: Column widths count doesn't match headers count. Using default widths.");
    widths.length = columnCount; // Adjust array size
    widths.fill(defaultColWidth);
  }

  const rowHeight = lineHeight;
  const cellPadding = 3;

  // Draw Header
  page.drawRectangle({
    x: startX,
    y: currentY - rowHeight,
    width: tableWidth,
    height: rowHeight,
    color: headerBgColor,
  });

  let currentX = startX;
  headers.forEach((header, i) => {
    drawTextSafe(page, header, {
      x: currentX + cellPadding,
      y: currentY - rowHeight + cellPadding + 2, // Adjust text position within cell
      font: headerFont,
      size: headerFontSize,
      color: headerTextColor,
    });
    currentX += widths[i];
  });
  currentY -= rowHeight;

  // Draw Data Rows
  data.forEach((row) => {
    currentX = startX;
    row.forEach((cell, i) => {
      drawTextSafe(page, cell, {
        x: currentX + cellPadding,
        y: currentY - rowHeight + cellPadding + 1,
        font: bodyFont,
        size: bodyFontSize,
        color: bodyTextColor,
      });
      currentX += widths[i];
    });

    // Draw row bottom border
    page.drawLine({
      start: { x: startX, y: currentY - rowHeight },
      end: { x: startX + tableWidth, y: currentY - rowHeight },
      thickness: 0.5,
      color: borderColor,
    });

    currentY -= rowHeight;
  });

  // Draw Table Borders (Outer and Vertical Column Lines)
  page.drawRectangle({
      x: startX,
      y: currentY,
      width: tableWidth,
      height: startY - currentY,
      borderColor: borderColor,
      borderWidth: 0.5,
  });

  currentX = startX;
  for (let i = 0; i < columnCount -1 ; i++) { // Draw vertical lines between columns
      currentX += widths[i];
      page.drawLine({
          start: { x: currentX, y: startY },
          end: { x: currentX, y: currentY },
          thickness: 0.5,
          color: borderColor,
      });
  }

  return currentY; // Return the Y position below the drawn table
}
// --- END TABLE HELPER --- 
