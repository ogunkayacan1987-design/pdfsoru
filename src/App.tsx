import React, { useState, useCallback } from 'react';
import { UploadCloud, Trash2, CheckCircle2, Maximize2, Minimize2, Settings2, Crop, FolderDown, ArrowLeftRight } from 'lucide-react';
import jsPDF from 'jspdf';
import ReactCrop, { type Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import optik30 from './assets/optik_30.png';
import optik60 from './assets/optik_60.png';
import optik90 from './assets/optik_90.png';

interface Question {
  id: string;
  file: File;
  previewUrl: string;
  answer: string | null;
  expandType: 'none' | 'normal' | 'half' | 'full';
}

interface Section {
  id: string;
  start: string;
  end: string;
  title: string;
}

interface CropModalState {
  isOpen: boolean;
  questionId: string | null;
  crop: CropType;
}

const MAX_QUESTIONS = 90;
const OPTIONS = ['A', 'B', 'C', 'D', 'E'];
const DRIVE_API_KEY = 'AIzaSyBEJzQv2ANAFfGQSuT5Mv63dQezJfaCakQ';

const OPTIK_MAP: Record<string, string> = {
  '30': optik30,
  '60': optik60,
  '90': optik90
};

// Helper to convert File to Image and Data URL
const loadImage = (file: File): Promise<{ img: HTMLImageElement, dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => resolve({ img, dataUrl });
      img.onerror = () => reject(new Error(`Görsel okunamadı: ${file.name}. Dosya bozuk veya desteklenmeyen bir biçimde olabilir.`));
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error(`Dosya okuma asamasında hata oluştu: ${file.name}`));
    reader.readAsDataURL(file);
  });
};

function App() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form Ayarları State
  const [testAdi, setTestAdi] = useState('');
  const [okulAdi, setOkulAdi] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [sinifSube, setSinifSube] = useState('');
  const [grup, setGrup] = useState('Grup Yok');

  // Optik Form State
  const [optikEkle, setOptikEkle] = useState(false);
  const [optikTipi, setOptikTipi] = useState<'30' | '60' | '90'>('30');

  // Bölümler (Sections) State
  const [sections, setSections] = useState<Section[]>([]);

  // Kırpma (Crop) State
  const [cropModal, setCropModal] = useState<CropModalState>({
    isOpen: false,
    questionId: null,
    crop: { unit: '%', width: 50, height: 50, x: 25, y: 25 }
  });
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);

  // Google Drive State
  const [driveFolderLink, setDriveFolderLink] = useState('');
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);

  // Dosya Yükleme İşlemleri
  const handleFiles = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/jpeg') || file.type.startsWith('image/jpg') || file.type.startsWith('image/png'));

    setQuestions(prev => {
      const remainingSlots = MAX_QUESTIONS - prev.length;
      const filesToAdd = validFiles.slice(0, remainingSlots);

      if (validFiles.length > remainingSlots) {
        alert(`Maksimum ${MAX_QUESTIONS} soru yükleyebilirsiniz.`);
      }

      const newQuestions = filesToAdd.map(file => {
        // Dosya isminden cevap şıkkını çıkarma (örn: 1A.jpg, soru_15b.png)
        // Noktadan önceki son karakteri alır. Eğer bu karakter A, B, C, D veya E (büyük/küçük harf) ise cevap olarak ayarlar.
        let autoAnswer: string | null = null;
        const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const match = fileNameWithoutExt.match(/([a-eA-E])$/);

        if (match) {
          autoAnswer = match[1].toUpperCase();
        }

        return {
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          answer: autoAnswer,
          expandType: 'none' as const
        };
      });

      return [...prev, ...newQuestions];
    });
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  // Soru İşlemleri
  const removeQuestion = (id: string, url: string) => {
    URL.revokeObjectURL(url);
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const setAnswer = (id: string, answer: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, answer } : q));
  };

  const setExpandType = (id: string, type: 'none' | 'normal' | 'half' | 'full') => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, expandType: type } : q));
  };

  const swapQuestion = (currentIndex: number) => {
    const targetQStr = prompt(`Bu soruyu kaçıncı soru ile yer değiştirmek istiyorsunuz? (Mevcut Sıra: ${currentIndex + 1}, Toplam Soru: ${questions.length})`);
    if (!targetQStr) return;

    const targetIndex = parseInt(targetQStr, 10) - 1;
    if (isNaN(targetIndex) || targetIndex < 0 || targetIndex >= questions.length) {
      alert("Lütfen geçerli bir soru numarası giriniz.");
      return;
    }

    if (targetIndex === currentIndex) return;

    setQuestions(prev => {
      const newArr = [...prev];
      const temp = newArr[currentIndex];
      newArr[currentIndex] = newArr[targetIndex];
      newArr[targetIndex] = temp;
      return newArr;
    });
  };

  // Google Drive İşlemleri
  const extractFolderId = (url: string) => {
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    const idMatch = url.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch) return idMatch[1];
    return null;
  };

  const fetchDriveImages = async () => {
    const folderId = extractFolderId(driveFolderLink);
    if (!folderId) {
      alert("Geçerli bir Google Drive Klasör linki giriniz.");
      return;
    }

    setIsFetchingDrive(true);
    try {
      // 1. Klasördeki resim dosyalarını listele
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType+contains+'image/'&key=${DRIVE_API_KEY}&fields=files(id,name,mimeType)`;
      const listResponse = await fetch(listUrl);

      if (!listResponse.ok) {
        throw new Error(`Google Drive API Hatası: ${listResponse.statusText}. Klasörün 'Bağlantıya sahip herkes görebilir' olarak ayarlandığından emin olun.`);
      }

      const listData = await listResponse.json();
      const filesInfo = listData.files;

      if (!filesInfo || filesInfo.length === 0) {
        alert("Bu klasörde herhangi bir görsel (resim) bulunamadı veya klasör herkese açık değil.");
        setIsFetchingDrive(false);
        return;
      }

      // Dosyaları içerdikleri sayılara göre sırala
      filesInfo.sort((a: any, b: any) => {
        const numA = parseInt(a.name.match(/\d+/) || ['0'][0], 10);
        const numB = parseInt(b.name.match(/\d+/) || ['0'][0], 10);
        return numA - numB;
      });

      // 2. Kalan soru kapasitesini kontrol et
      const remainingSlots = MAX_QUESTIONS - questions.length;
      if (remainingSlots <= 0) {
        alert(`Maksimum ${MAX_QUESTIONS} soru yükleyebilirsiniz.`);
        setIsFetchingDrive(false);
        return;
      }

      const filesToFetch = filesInfo.slice(0, remainingSlots);
      const downloadedFiles: File[] = [];

      // 3. Dosyaları indir
      for (const fileInfo of filesToFetch) {
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileInfo.id}?alt=media&key=${DRIVE_API_KEY}`;
        const response = await fetch(downloadUrl);
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], fileInfo.name, { type: fileInfo.mimeType || 'image/jpeg' });
          downloadedFiles.push(file);
        }
      }

      if (downloadedFiles.length > 0) {
        handleFiles(downloadedFiles);
      } else {
        alert("Görseller indirilemedi.");
      }

      setDriveFolderLink(''); // Başarılı olunca input'u temizle
    } catch (error) {
      console.error("Drive fetch error:", error);
      alert(error instanceof Error ? error.message : "Google Drive'dan görseller çekilirken bir hata oluştu.");
    } finally {
      setIsFetchingDrive(false);
    }
  };

  // Kırpma İşlemleri
  const openCropModal = (id: string) => {
    setCropModal({
      ...cropModal,
      isOpen: true,
      questionId: id,
    });
    setImageRef(null); // Reset before opening
  };

  const closeCropModal = () => {
    setCropModal({ ...cropModal, isOpen: false, questionId: null });
    setImageRef(null);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageRef(e.currentTarget);
  };

  const performCrop = async () => {
    if (!imageRef || !cropModal.crop.width || !cropModal.crop.height || !cropModal.questionId) {
      closeCropModal();
      return;
    }

    const currentQuestion = questions.find(q => q.id === cropModal.questionId);
    if (!currentQuestion) return;

    try {
      const canvas = document.createElement('canvas');
      const scaleX = imageRef.naturalWidth / imageRef.width;
      const scaleY = imageRef.naturalHeight / imageRef.height;
      const pixelRatio = window.devicePixelRatio;

      canvas.width = cropModal.crop.width * scaleX * pixelRatio;
      canvas.height = cropModal.crop.height * scaleY * pixelRatio;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('No 2d context');
      }

      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        imageRef,
        cropModal.crop.x * scaleX,
        cropModal.crop.y * scaleY,
        cropModal.crop.width * scaleX,
        cropModal.crop.height * scaleY,
        0,
        0,
        cropModal.crop.width * scaleX,
        cropModal.crop.height * scaleY
      );

      // Bloba çevir ve kaydet
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));

      if (blob) {
        // Eski URL'yi temizle
        URL.revokeObjectURL(currentQuestion.previewUrl);

        const newFile = new File([blob], `cropped_${currentQuestion.file.name}`, { type: 'image/jpeg' });
        const newPreviewUrl = URL.createObjectURL(newFile);

        setQuestions(prev => prev.map(q =>
          q.id === cropModal.questionId
            ? { ...q, file: newFile, previewUrl: newPreviewUrl }
            : q
        ));
      }
    } catch (e) {
      console.error("Kesme işlemi başarısız oldu:", e);
      alert("Görsel kırpılırken bir hata oluştu.");
    }

    closeCropModal();
  };

  // Bölüm İşlemleri
  const addSection = () => {
    setSections(prev => [...prev, { id: crypto.randomUUID(), start: '', end: '', title: '' }]);
  };

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const updateSection = (id: string, field: keyof Section, value: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const generatePDF = async () => {
    if (questions.length === 0) return;
    setIsGenerating(true);

    try {
      // --- SORULAR PDF'İ OLUŞTURMA ---
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const marginX = 7.5;
      const marginY = 0;
      const pageHeight = 297;
      const pageWidth = 210;
      const colGap = 10;
      const colWidth = (pageWidth - (marginX * 2) - colGap) / 2;
      const fullWidth = pageWidth - (marginX * 2);
      const MAX_IMG_HEIGHT = 105;

      const primaryColor: [number, number, number] = [220, 38, 38]; // Vurgulayıcı Kırmızı (Resim 3 uyarınca)

      // Türkçe Harf Değiştirici
      const fixTr = (text: string) => {
        return text
          .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
          .replace(/Ü/g, 'U').replace(/ü/g, 'u')
          .replace(/Ş/g, 'S').replace(/ş/g, 's')
          .replace(/İ/g, 'I').replace(/ı/g, 'i')
          .replace(/Ö/g, 'O').replace(/ö/g, 'o')
          .replace(/Ç/g, 'C').replace(/ç/g, 'c');
      };

      const drawFooter = (pdfDoc: jsPDF, pNum: number) => {
        const footY = pageHeight - 4; // Margin bottom 0 olduğu için alt köşeye daha yakın
        pdfDoc.setDrawColor(...primaryColor);
        pdfDoc.setLineWidth(0.8);
        pdfDoc.line(0, footY - 4, pageWidth, footY - 4);
        pdfDoc.setDrawColor(0, 0, 0);
        pdfDoc.setLineWidth(0.2);

        pdfDoc.setFont('helvetica', 'normal');
        pdfDoc.setFontSize(10);
        pdfDoc.setTextColor(100, 116, 139);
        const fText = okulAdi ? fixTr(okulAdi).toUpperCase() : "SORU BANKASI";
        pdfDoc.text(fText, 5, footY);
        pdfDoc.text(pNum.toString(), pageWidth - 5, footY, { align: 'right' });
      };

      const drawHeader = (pdfDoc: jsPDF) => {
        let hdrY = 0; // Margin top 0
        const boxMargin = 0;
        const boxTop = hdrY;
        const boxWidth = pageWidth;
        const boxHeight = 12; // V7 Çok Daha Kompakt (2 Satır)!

        pdfDoc.setDrawColor(...primaryColor);
        pdfDoc.setLineWidth(0.8);
        pdfDoc.setFillColor(248, 250, 252);
        pdfDoc.rect(boxMargin, boxTop, boxWidth, boxHeight, 'FD');

        pdfDoc.setFont('helvetica', 'bold');

        // Üst Başlık ve Alt Başlık 2 satır tek hizaya birleştirildi
        const line1 = [okulAdi ? fixTr(okulAdi).toUpperCase() : '', testAdi ? fixTr(testAdi).toUpperCase() : ''].filter(Boolean).join(' - ');

        if (line1) {
          pdfDoc.setFontSize(12);
          pdfDoc.setTextColor(30, 41, 59);
          pdfDoc.text(line1, pageWidth / 2, hdrY + 5.5, { align: 'center' });
        }

        const line2 = `${sinifSube ? 'Sinif: ' + fixTr(sinifSube) : ''} ${grup !== 'Grup Yok' ? '| Grup: ' + fixTr(grup) : ''}`.trim();
        if (line2) {
          pdfDoc.setFontSize(10);
          pdfDoc.setFont('helvetica', 'normal');
          pdfDoc.text(line2, pageWidth / 2, hdrY + 9.5, { align: 'center' });
        }

        return boxTop + boxHeight + 2; // Altından devam edilecek güvenli hiza
      };

      const drawVerticalLine = (topY: number, botY: number) => {
        if (botY > topY + 5) {
          doc.setDrawColor(...primaryColor);
          doc.setLineWidth(0.5);
          doc.line(pageWidth / 2, topY, pageWidth / 2, botY);
          doc.setDrawColor(0, 0, 0);
          doc.setLineWidth(0.2);
        }
      };

      let startY = drawHeader(doc);
      let pageNum = 1;

      let activeColumn = 0; // 0 sol, 1 sağ
      let currentY = startY;
      let maxBottomY = startY;
      let columnStartY = startY;

      const commitVerticalLine = () => {
        if (maxBottomY > columnStartY + 5) {
          drawVerticalLine(columnStartY, maxBottomY);
        }
        columnStartY = maxBottomY;
        currentY = maxBottomY;
        activeColumn = 0;
      };

      const addNewPage = () => {
        const footerY = pageHeight - 8; // Alt çizgi hizası
        drawVerticalLine(columnStartY, footerY); // Sayfa sonuna kadar in
        drawFooter(doc, pageNum);

        doc.addPage();
        pageNum++;

        const newPageStart = marginY + 2; // 2mm padding for new page
        currentY = newPageStart;
        columnStartY = newPageStart;
        maxBottomY = newPageStart;
        activeColumn = 0;
      };

      const drawSectionHeader = (title: string, startYTitle: number): number => {
        commitVerticalLine(); // Any previous layout stops

        // Check if there is enough space for a header (e.g. 20mm + some cushion)
        if (startYTitle > pageHeight - 25) {
          addNewPage();
          startYTitle = currentY;
        }

        const boxHeight = 10;
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(marginX, startYTitle, fullWidth, boxHeight, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...primaryColor);
        doc.text(fixTr(title).toUpperCase(), pageWidth / 2, startYTitle + 6.5, { align: 'center' });

        const endY = startYTitle + boxHeight + 5; // Start drawing questions below the header

        // Reset states for below header
        currentY = endY;
        columnStartY = endY;
        maxBottomY = endY;
        activeColumn = 0;

        return endY;
      };

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNumber = i + 1;

        // Check for Section Header
        const sectionHeader = sections.find(s => parseInt(s.start) === qNumber);
        if (sectionHeader && sectionHeader.title) {
          // Force layout commit and draw header
          currentY = Math.max(currentY, maxBottomY);
          currentY = drawSectionHeader(sectionHeader.title, currentY + 5);
        }

        const { img, dataUrl } = await loadImage(q.file);

        const numberWidth = 8;
        const targetImgWidth = q.expandType !== 'none' ? (fullWidth - numberWidth) : (colWidth - numberWidth);

        let renderWidth = targetImgWidth;
        let renderHeight = (img.naturalHeight / img.naturalWidth) * targetImgWidth;

        let currentMaxHeight = MAX_IMG_HEIGHT;
        if (q.expandType === 'half') currentMaxHeight = 135;
        if (q.expandType === 'full') currentMaxHeight = 275;

        if (renderHeight > currentMaxHeight) {
          renderHeight = currentMaxHeight;
          renderWidth = (img.naturalWidth / img.naturalHeight) * renderHeight;
        }

        const spacing = 8; // V7: 12'den 8'e düşürdük, alandan tasarruf
        const totalItemHeight = renderHeight + spacing;

        const printRow = (x: number, y: number) => {
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(`${i + 1}.`, x, y + 4);
          try { doc.addImage(dataUrl, 'JPEG', x + numberWidth, y, renderWidth, renderHeight, '', 'FAST'); } catch (err) { }
        };

        if (q.expandType !== 'none') {
          commitVerticalLine();

          if (currentY + totalItemHeight > pageHeight - 9) { // Header/footer paddingleri sıfırlandı sayılır, limit daha alta çekildi
            addNewPage();
          }

          printRow(marginX, currentY);

          currentY += totalItemHeight;
          maxBottomY = currentY;
          columnStartY = currentY; // Dikey çizgi buradan sonrasından sürecek
          activeColumn = 0;

        } else {
          if (currentY + totalItemHeight > pageHeight - 9) {
            if (activeColumn === 0) {
              activeColumn = 1;
              currentY = columnStartY;
              if (currentY + totalItemHeight > pageHeight - 9) {
                addNewPage(); // Sağ sütun da sığmıyorsa mecburen yeni sayfa!
              }
            } else {
              addNewPage();
            }
          }

          const targetX = activeColumn === 0 ? marginX : marginX + colWidth + colGap;
          printRow(targetX, currentY);

          currentY += totalItemHeight;
          if (currentY > maxBottomY) maxBottomY = currentY;
        }
      }

      // Döngü tamam
      if (maxBottomY > columnStartY) drawVerticalLine(columnStartY, maxBottomY);
      drawFooter(doc, pageNum);

      // --- OPTİK FORM (Eğer seçildiyse son sayfaya bas) ---
      if (optikEkle) {
        doc.addPage();
        // Optik Form Resmini tam sayfa basacağız (marginleri hafif kısarak daha belirgin)
        const optMargin = 10;
        const optWidth = pageWidth - (optMargin * 2);
        // 3 Farklı Optik Asset PNG'si
        const optSrc = OPTIK_MAP[optikTipi];

        const drawOptik = async () => {
          return new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              // Yüksekliği resmin doğal boyutuna göre ayarlayalım
              const optHeight = (img.naturalHeight / img.naturalWidth) * optWidth;
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.fillStyle = '#FFFFFF';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0);
                  doc.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', optMargin, optMargin, optWidth, optHeight, '', 'FAST');
                }
                resolve();
              } catch (er) {
                reject(er);
              }
            };
            img.onerror = () => reject("Optik resim bulunamadı.");
            img.src = optSrc;
          });
        };
        try {
          await drawOptik();
        } catch (e) { console.error("Optik form eklenemedi:", e); }
      }

      // --- CEVAP ANAHTARI PDF'İ ---
      const ansDoc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      let ansY = marginY;
      ansDoc.setFontSize(16);
      ansDoc.setFont('helvetica', 'bold');
      ansDoc.setTextColor(...primaryColor);
      ansDoc.text("CEVAP ANAHTARI", pageWidth / 2, ansY, { align: 'center' });

      const testBaslik = testAdi || okulAdi;
      if (testBaslik) {
        ansY += 7;
        ansDoc.setFontSize(12);
        ansDoc.setTextColor(100, 116, 139);
        ansDoc.text(fixTr(testBaslik).toUpperCase(), pageWidth / 2, ansY, { align: 'center' });
      }
      ansY += 15;

      ansDoc.setFontSize(11);
      let ansX = marginX + 20;

      for (let i = 0; i < questions.length; i++) {
        ansDoc.setFont('helvetica', 'bold');
        ansDoc.setTextColor(30, 41, 59);
        ansDoc.text(`Soru ${i + 1}:`, ansX, ansY);

        ansDoc.setFont('helvetica', 'normal');
        const ansText = questions[i].answer || 'Bos';
        if (ansText === 'Bos') ansDoc.setTextColor(239, 68, 68);
        else ansDoc.setTextColor(16, 185, 129);

        ansDoc.text(ansText, ansX + 20, ansY);
        ansY += 8;

        if (ansY > pageHeight - 10) {
          ansY = 20;
          ansX += 60;
        }
      }

      // Dosyaları Kaydet (İki farklı PDF)
      const baseName = testAdi ? fixTr(testAdi).replace(/\s+/g, '_') : 'Sinav';

      if (Capacitor.isNativePlatform()) {
        try {
          const pdfBase64 = doc.output('datauristring').split(',')[1];
          const savedSorular = await Filesystem.writeFile({
            path: `${baseName}_Sorular.pdf`,
            data: pdfBase64,
            directory: Directory.Cache
          });

          await Share.share({
            title: 'Sınav Soruları PDF',
            url: savedSorular.uri,
            dialogTitle: 'Soruları Paylaş'
          });

          const ansBase64 = ansDoc.output('datauristring').split(',')[1];
          const savedCevap = await Filesystem.writeFile({
            path: `${baseName}_CevapAnahtari.pdf`,
            data: ansBase64,
            directory: Directory.Cache
          });

          // Cevap anahtarı için kullanıcıya bilgi ver veya sessize al
          // Çünkü üst üste 2 share menüsü açmak Android'de sorun çıkarabilir.
          // Kullanıcı genellikle sınavı yazdırmak veya paylaşmak istiyor, cevap anahtarını da sadece telefona kaydedip indirebilir.
          alert(`PDF'ler önbelleğe oluşturuldu! Cevap anahtarını paylaşmak için tamam'a (OK) basınız.`);

          await Share.share({
            title: 'Cevap Anahtarı PDF',
            url: savedCevap.uri,
            dialogTitle: 'Cevap Anahtarı Paylaş'
          });

        } catch (e) {
          console.error("PDF dışa aktarma hatası:", e);
          alert('Uygulama içinde PDF başlatılamadı. Hata: ' + String(e));
        }
      } else {
        doc.save(`${baseName}_Sorular.pdf`);
        ansDoc.save(`${baseName}_CevapAnahtari.pdf`);
      }

    } catch (error) {
      console.error("PDF oluşturulurken hata:", error);
      alert(error instanceof Error ? error.message : "PDF oluşturulurken beklenmedik bir hata meydana geldi.");
    } finally {
      setIsGenerating(false);
    }
  };

  const answeredCount = questions.filter(q => q.answer !== null).length;

  return (
    <div className="main-layout">
      {/* Sol Panel: İçerik */}
      <div className="content">
        <header>
          <h1>Soru Bankası & PDF Oluşturucu</h1>
          <p className="subtitle">Maksimum 90 soru yükleyin, dar/geniş (2 sütun) ayarlayın ve cevap anahtarlı PDF'inizi alın.</p>
        </header>

        {/* Yükleme Alanı */}
        {questions.length < MAX_QUESTIONS && (
          <div
            className={`upload-zone glass-container ${isDragging ? 'drag-active' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            <input
              type="file"
              id="file-upload"
              multiple
              accept="image/jpeg, image/png, image/jpg"
              style={{ display: 'none' }}
              onChange={onFileInput}
            />
            <UploadCloud className="upload-icon" />
            <h2>Soruları Sürükleyip Bırakın</h2>
            <p style={{ color: 'var(--text-muted)' }}>Masaüstünden görselleri seçin veya buraya taşıyın (Maks. 90 soru)</p>
            <button className="btn btn-primary" onClick={(e) => e.stopPropagation()}>Bilgisayardan Seç</button>
          </div>
        )}

        {questions.length >= MAX_QUESTIONS && (
          <p className="limit-warning">Maksimum soru limitine (90) ulaştınız.</p>
        )}

        {/* Sorular Izgarası */}
        {questions.length > 0 && (
          <div className="questions-grid">
            {questions.map((q, index) => (
              <div key={q.id} className={`question-card split-card ${q.expandType !== 'none' ? 'is-expanded' : ''}`}>
                <div className="card-sidebar">
                  <span className="question-number">{index + 1}</span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center', background: 'var(--bg-card)', padding: '4px', borderRadius: '4px', width: '100%' }}>
                    <button className={`icon-btn ${q.expandType === 'none' ? 'active' : ''}`} title="Daralt" onClick={() => setExpandType(q.id, 'none')} style={{ padding: '4px' }}>
                      <Minimize2 size={16} color={q.expandType === 'none' ? 'var(--primary)' : 'currentColor'} />
                    </button>
                    <button className={`icon-btn ${q.expandType === 'normal' ? 'active' : ''}`} title="Genişlet (Normal)" onClick={() => setExpandType(q.id, 'normal')} style={{ padding: '4px' }}>
                      <Maximize2 size={16} color={q.expandType === 'normal' ? 'var(--primary)' : 'currentColor'} />
                    </button>
                    <button className={`icon-btn ${q.expandType === 'half' ? 'active' : ''}`} title="Yarım Sayfa Genişlet" style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px', color: q.expandType === 'half' ? 'var(--primary)' : 'currentColor' }} onClick={() => setExpandType(q.id, 'half')}>
                      1/2
                    </button>
                    <button className={`icon-btn ${q.expandType === 'full' ? 'active' : ''}`} title="Tam Sayfa Genişlet" style={{ fontSize: '10px', fontWeight: 'bold', padding: '4px', color: q.expandType === 'full' ? 'var(--primary)' : 'currentColor' }} onClick={() => setExpandType(q.id, 'full')}>
                      TAM
                    </button>
                  </div>

                  <button className="icon-btn" title="Soruyu Kırp" onClick={() => openCropModal(q.id)}>
                    <Crop size={20} />
                  </button>
                  <button className="icon-btn" title="Sırasını Değiştir" onClick={() => swapQuestion(index)}>
                    <ArrowLeftRight size={20} />
                  </button>
                  <button className="icon-btn danger" title="Soruyu Sil" onClick={() => removeQuestion(q.id, q.previewUrl)}>
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="card-content">
                  <div className="question-header">
                    <span className="question-badge">
                      {q.expandType === 'full' ? "Tam Sayfa" : q.expandType === 'half' ? "Yarım Sayfa" : q.expandType === 'normal' ? "Geniş Soru" : "Dar Soru (Tek Sütun)"}
                    </span>
                  </div>
                  <div className="question-image-container">
                    <img src={q.previewUrl} alt={`Soru ${index + 1}`} className="question-image" />
                  </div>

                  <div className="options-group">
                    {OPTIONS.map(opt => (
                      <button
                        key={opt}
                        className={`option-btn ${q.answer === opt ? 'selected' : ''}`}
                        onClick={() => setAnswer(q.id, opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sağ Panel: Form Ayarları ve Durum */}
      <div className="sidebar glass-container">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings2 size={24} color="var(--primary)" />
          Kağıt Ayarları
        </h2>

        <div className="form-group">
          <input type="text" placeholder="Okul / Kurum Adı" className="form-input" value={okulAdi} onChange={e => setOkulAdi(e.target.value)} />
          <input type="text" placeholder="Kitapçık / Test Adı" className="form-input" value={testAdi} onChange={e => setTestAdi(e.target.value)} />
          <input type="text" placeholder="Test ile ilgili açıklama (Örn: Kazanım 1)" className="form-input" value={aciklama} onChange={e => setAciklama(e.target.value)} />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="text" placeholder="Sınıf/Şube" className="form-input" style={{ flex: 1 }} value={sinifSube} onChange={e => setSinifSube(e.target.value)} />
            <select className="form-input" style={{ flex: 1 }} value={grup} onChange={e => setGrup(e.target.value)}>
              <option value="Grup Yok">Grup Yok</option>
              <option value="A Grubu">A Grubu</option>
              <option value="B Grubu">B Grubu</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
            <FolderDown size={20} color="var(--primary)" />
            Google Drive'dan Çek
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '0.5rem' }}>
            <input
              type="text"
              placeholder="Drive Klasör Linkini Yapıştır"
              className="form-input"
              value={driveFolderLink}
              onChange={e => setDriveFolderLink(e.target.value)}
            />
            <button
              className="btn btn-secondary"
              onClick={fetchDriveImages}
              disabled={isFetchingDrive || !driveFolderLink || questions.length >= MAX_QUESTIONS}
            >
              {isFetchingDrive ? 'İndiriliyor...' : 'Klasördeki Görselleri Çek'}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              * Klasörün paylaşım ayarı "Bağlantıya sahip olan herkes görebilir" olmalıdır.
            </p>
          </div>
        </div>

        {/* V6 - Optik Form Seçenekleri */}
        <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={optikEkle}
              onChange={e => setOptikEkle(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
            />
            Sınav Sonuna Optik Form Ekle
          </label>

          {optikEkle && (
            <div style={{ marginTop: '0.8rem', display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Optik Form Tipi:</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="radio" name="optikType" checked={optikTipi === '30'} onChange={() => setOptikTipi('30')} /> 30'luk
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="radio" name="optikType" checked={optikTipi === '60'} onChange={() => setOptikTipi('60')} /> 60'lık
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                  <input type="radio" name="optikType" checked={optikTipi === '90'} onChange={() => setOptikTipi('90')} /> 90'lık
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Bölüm Başlıkları (Sections) */}
        <div className="form-group" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <label style={{ fontWeight: 600 }}>Bölüm Başlıkları</label>
            <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={addSection}>
              + Alan Ekle
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sections.map((section) => (
              <div key={section.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-card)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                <input
                  type="number"
                  placeholder="Baş"
                  className="form-input"
                  style={{ width: '50px', padding: '0.25rem' }}
                  value={section.start}
                  onChange={e => updateSection(section.id, 'start', e.target.value)}
                />
                <span style={{ color: 'var(--text-muted)' }}>-</span>
                <input
                  type="number"
                  placeholder="Bit"
                  className="form-input"
                  style={{ width: '50px', padding: '0.25rem' }}
                  value={section.end}
                  onChange={e => updateSection(section.id, 'end', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Başlık (Örn: TÜRKÇE)"
                  className="form-input"
                  style={{ flex: 1, padding: '0.25rem' }}
                  value={section.title}
                  onChange={e => updateSection(section.id, 'title', e.target.value)}
                />
                <button className="icon-btn danger" style={{ padding: '0.25rem' }} onClick={() => removeSection(section.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {sections.length === 0 && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                PDF içine özel başlıklar eklemek için alan ekleyin.
              </div>
            )}
          </div>
        </div>

        <div style={{ margin: '1.5rem 0', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <div className="stat-item">
            <span className="stat-label">Toplam Soru:</span>
            <span className="stat-value">{questions.length} / {MAX_QUESTIONS}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">Cevaplı Soru:</span>
            <span className="stat-value" style={{ color: answeredCount === questions.length && questions.length > 0 ? 'var(--secondary)' : 'inherit' }}>
              {answeredCount} / {questions.length}
            </span>
          </div>
        </div>

        <div className="action-buttons">
          <button
            className="btn btn-primary"
            disabled={questions.length === 0 || isGenerating}
            onClick={generatePDF}
            style={{ padding: '1rem', fontSize: '1.1rem', backgroundColor: '#3B82F6', boxShadow: 'none' }}
          >
            {isGenerating ? 'Hazırlanıyor...' : 'Kağıdı Hazırla'}
          </button>

          {answeredCount === questions.length && questions.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.875rem', fontWeight: '500' }}>
              <CheckCircle2 size={16} /> Tüm sorular cevaplandı!
            </div>
          )}
        </div>
      </div>

      {/* Kırpma Modalı */}
      {cropModal.isOpen && cropModal.questionId && (
        <div className="modal-overlay" onClick={closeCropModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Soruyu Kırp</h2>
              <button className="icon-btn" onClick={closeCropModal}>✕</button>
            </div>

            <div className="crop-container" style={{ maxHeight: '60vh', overflow: 'auto', display: 'flex', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '1rem' }}>
              <ReactCrop
                crop={cropModal.crop}
                onChange={c => setCropModal({ ...cropModal, crop: c })}
              >
                <img
                  src={questions.find(q => q.id === cropModal.questionId)?.previewUrl}
                  alt="Kırpılacak Görsel"
                  style={{ maxWidth: '100%', objectFit: 'contain' }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={closeCropModal}>İptal</button>
              <button className="btn btn-primary" onClick={performCrop}>Kırp ve Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
