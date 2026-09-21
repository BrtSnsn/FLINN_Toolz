document.addEventListener('DOMContentLoaded', () => {
    const FIXED_VALUE = 'MTFLINN';
    const input = document.getElementById('barcodeInput');
    const printButton = document.getElementById('printButton');
    const inputMessage = document.getElementById('inputMessage');
    const customBarcodeBlock = document.getElementById('customBarcodeBlock');
    const customBarcodeCaption = document.getElementById('customBarcodeCaption');
    const printedDate = document.getElementById('printedDate');

    const formatDate = () => new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'long',
        day: '2-digit'
    }).format(new Date());

    const renderBarcode = (selector, value) => {
        JsBarcode(selector, value, {
            format: 'CODE128',
            width: 2,
            height: 110,
            margin: 0,
            displayValue: false,
            background: '#ffffff',
            lineColor: '#000000'
        });
    };

    const updateCustomBarcode = () => {
        const value = input.value;
        const isReady = value.trim().length > 0;

        printButton.disabled = !isReady;
        customBarcodeBlock.classList.toggle('barcode-block--pending', !isReady);
        inputMessage.classList.toggle('input-message--ready', isReady);

        if (!isReady) {
            document.getElementById('customBarcode').replaceChildren();
            customBarcodeCaption.textContent = 'Your text will appear here';
            inputMessage.textContent = 'Enter a value to enable printing.';
            return;
        }

        renderBarcode('#customBarcode', value);
        document.getElementById('customBarcode').setAttribute('aria-label', `CODE 128 barcode for ${value}`);
        customBarcodeCaption.textContent = value;
        inputMessage.textContent = 'Your barcode is ready to print.';
    };

    printedDate.textContent = formatDate();
    printedDate.dateTime = new Date().toISOString().slice(0, 10);
    renderBarcode('#fixedBarcode', FIXED_VALUE);

    input.addEventListener('input', updateCustomBarcode);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !printButton.disabled) {
            event.preventDefault();
            printButton.click();
        }
    });

    printButton.addEventListener('click', () => {
        printedDate.textContent = formatDate();
        window.print();
    });

    updateCustomBarcode();
    input.focus();
});
