

import * as pdfjsLib from 'pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.mjs';

let pdfDoc = null;
let occurrenceCount = {
    "DEPÓSITO FGTS": 0,
    "IRPF DEVIDO PELO RECLAMANTE": 0,
    "HONORÁRIOS LÍQUIDOS PARA": 0
};

// Variáveis para armazenar valores específicos
let honorariosRTEValues = [];
let honorariosRDAValues = [];
let honorariosPericValues = [];
let custasJudiciaisValues = [];

// Variáveis para somar valores específicos
let principalValue = 0;
let fgtsDepositoValue = 0;
let inssRte = 0;
let inssRda = 0;
let satValue = 0;
let irpfDevidoValue = 0; 
let lastCustasIndex = -1; // Variável para armazenar o índice de "CUSTAS JUDICIAIS DEVIDAS"

document.getElementById('file-input').addEventListener('change', (event) => {
    let file = event.target.files[0];
    let reader = new FileReader();

    reader.onload = function () {
        let typedarray = new Uint8Array(this.result);

        pdfjsLib.getDocument(typedarray).promise.then((pdf) => {
            pdfDoc = pdf;
            searchForSATTable();
            searchForESocialEvent();
        }).catch((error) => {
            console.error("Erro ao carregar PDF: ", error);
        });
    };

    reader.readAsArrayBuffer(file);
});

function searchForSATTable() {
    let numPages = pdfDoc.numPages;
    let pageNum = 1;

    function processPage(pageNum) {
        pdfDoc.getPage(pageNum).then((page) => {
            page.getTextContent().then((textContent) => {
                let textItems = textContent.items;
                for (let i = 0; i < textItems.length; i++) {
                    if (textItems[i].str.includes("SEGURO DE ACIDENTE DO TRABALHO (SAT)")) {
                        let fourthLastNumericValue = findFourthLastNumericValue(textItems, i);
                        if (fourthLastNumericValue !== null) {
                            satValue = fourthLastNumericValue; // Armazena o valor em uma variável específica
                            console.log("SAT Value Found:", formatBrazilianCurrency(satValue)); // Log do valor SAT encontrado
                            addRowToTable("SAT", formatBrazilianCurrency(satValue));
                        } else {
                            addRowToTable("SAT", "N/A");
                        }
                        return;
                    }
                }
                if (pageNum < numPages) {
                    processPage(pageNum + 1);
                }
            }).catch((error) => {
                console.error("Erro ao processar página " + pageNum, error);
            });
        }).catch((error) => {
            console.error("Erro ao obter página " + pageNum, error);
        });
    }

    processPage(pageNum);
}


function searchForESocialEvent() {
    let numPages = pdfDoc.numPages;
    let pageNum = 1;
    let honorariosIndex = -1;
    let descricaoDebitosIndex = -1;
    let honorariosOccurrenceCount = 0; // Adicionado para contar as ocorrências de "HONORÁRIOS LÍQUIDOS PARA"

    function processPage(pageNum) {
        pdfDoc.getPage(pageNum).then((page) => {
            page.getTextContent().then((textContent) => {
                let textItems = textContent.items;

                for (let i = 0; i < textItems.length; i++) {
                    if (textItems[i].str.includes("HONORÁRIOS LÍQUIDOS PARA")) {
                        honorariosOccurrenceCount++; // Incrementa o contador de ocorrências
                        honorariosIndex = i;
                    }
                    
                    if (textItems[i].str.includes("Descrição de Débitos do Reclamante")) {
                        descricaoDebitosIndex = i;
                        
                        let positionMessage = "O texto 'HONORÁRIOS LÍQUIDOS PARA' ";
                        if (honorariosIndex === -1) {
                            positionMessage += "não foi encontrado antes do texto 'Descrição de Débitos do Reclamante'.";
                        } else if (honorariosIndex < descricaoDebitosIndex) {
                            positionMessage += "está antes do texto 'Descrição de Débitos do Reclamante'.";
                        } else {
                            positionMessage += "está depois do texto 'Descrição de Débitos do Reclamante'.";
                        }                        
                        console.log(positionMessage);
                    }

                    if (textItems[i].str.includes("eSocial - Evento S-2500")) {
                        let fourthLastNumericValue = findFourthLastNumericValue(textItems, i);
                        if (fourthLastNumericValue !== null) {
                            satValue = fourthLastNumericValue; // Atualiza o valor SAT com o encontrado no evento eSocial
                            console.log("SAT Value Found in eSocial Event:", formatBrazilianCurrency(satValue)); // Log do valor SAT encontrado no evento eSocial
                            addRowToTable("SAT", formatBrazilianCurrency(satValue));
                        } else {
                            addRowToTable("SAT", "N/A");
                        }
                        return;
                    } else if (textItems[i].str.includes("Nome: SEGURO DE ACIDENTE DO TRABALHO (SAT)")) {
                        let antepenultimateNumericValue = findAntepenultimateNumericValue(textItems, i);
                        if (antepenultimateNumericValue !== null) {
                            inssRda = antepenultimateNumericValue; // Armazena o valor em uma variável específica
                            addRowToTable("INSS RDA", formatBrazilianCurrency(inssRda));
                        } else {
                            addRowToTable("INSS RDA", "N/A");
                        }
                    } else if (textItems[i].str.includes("Nome: CONTRIBUIÇÃO SOCIAL EMPRESA")) {
                        let thirdLastNumericValueForContribution = findAntepenultimateNumericValue(textItems, i);
                        if (thirdLastNumericValueForContribution !== null) {
                            inssRte = thirdLastNumericValueForContribution; // Armazena o valor em uma variável específica
                            addRowToTable("INSS RTE", formatBrazilianCurrency(inssRte));
                        } else {
                            addRowToTable("INSS RTE", "N/A");
                        }
                    } else if (textItems[i].str.includes("DEPÓSITO FGTS")) {
                        occurrenceCount["DEPÓSITO FGTS"]++;
                        let rightCellValue = findRightCellValue(textItems, i);
                        if (rightCellValue !== null) {
                            fgtsDepositoValue = rightCellValue; // Armazena o valor em uma variável específica
                            addRowToTable("FGTS (A DEPOSITAR)", formatBrazilianCurrency(fgtsDepositoValue));
                        } else {
                            addRowToTable("FGTS (A DEPOSITAR)", "N/A");
                        }
                    } else if (textItems[i].str.includes("IRPF DEVIDO PELO RECLAMANTE")) {
                        occurrenceCount["IRPF DEVIDO PELO RECLAMANTE"]++;
                        irpfDevidoValue = findRightCellValue(textItems, i); // Atualiza a variável personalizada
                        if (irpfDevidoValue !== null) {
                            addRowToTable(getNewLabel("IRPF DEVIDO PELO RECLAMANTE", occurrenceCount["IRPF DEVIDO PELO RECLAMANTE"]), formatBrazilianCurrency(irpfDevidoValue));
                        } else {
                            addRowToTable(getNewLabel("IRPF DEVIDO PELO RECLAMANTE", occurrenceCount["IRPF DEVIDO PELO RECLAMANTE"]), "N/A");
                        }
                    } else {
                        let textFound = ["LÍQUIDO DEVIDO AO RECLAMANTE", "HONORÁRIOS LÍQUIDOS PARA", "CUSTAS JUDICIAIS DEVIDAS"]
                            .find(text => textItems[i].str.includes(text));

                        if (textFound) {
                            occurrenceCount[textFound]++; // Atualiza o contador global

                            let rightCellValue = findRightCellValue(textItems, i);

                            let label = getNewLabel(textFound, occurrenceCount[textFound]);

                            if (textFound === "HONORÁRIOS LÍQUIDOS PARA" && descricaoDebitosIndex !== -1 && honorariosIndex > descricaoDebitosIndex) {
                                label = "HONOR P/ RDA"; // Atualiza o label se "HONORÁRIOS LÍQUIDOS PARA" estiver depois de "Descrição de Débitos do Reclamante"
                            }

                            if (rightCellValue !== null) {
                                if (textFound === "LÍQUIDO DEVIDO AO RECLAMANTE") {
                                    principalValue = rightCellValue; // Armazena o valor em uma variável específica
                                    addRowToTable("PRINCIPAL", formatBrazilianCurrency(principalValue));
                                } else if (textFound === "HONORÁRIOS LÍQUIDOS PARA") {
                                    if (honorariosOccurrenceCount === 1) {
                                        honorariosRTEValues.push(rightCellValue);
                                        addRowToTable(label, formatBrazilianCurrency(rightCellValue));
                                    } else if (honorariosOccurrenceCount === 2) {
                                        honorariosPericValues.push(rightCellValue);
                                        addRowToTable(label, formatBrazilianCurrency(rightCellValue));
                                    }
                                } else if (textFound === "CUSTAS JUDICIAIS DEVIDAS") {
                                    custasJudiciaisValues.push(rightCellValue);
                                    lastCustasIndex = i;
                                    addRowToTable(label, formatBrazilianCurrency(rightCellValue));
                                }
                            } else {
                                addRowToTable(label, "N/A");
                            }
                        }
                    }
                }

                if (pageNum < numPages) {
                    processPage(pageNum + 1);
                } else {
                    // Quando terminar de processar todas as páginas, calcular e mostrar a soma total
                    displayTotal();
                }

            }).catch((error) => {
                console.error("Erro ao processar página " + pageNum, error);
            });
        }).catch((error) => {
            console.error("Erro ao obter página " + pageNum, error);
        });
    }

    processPage(pageNum);
}

function displayTotal() {
    

    // Log dos valores da tabela e soma total
    console.log("Valores da Tabela:");
    tableRows.forEach(row => {
        console.log(row.description + ": " + row.value);
    });

    // Verifica se os arrays têm valores
    console.log("Honorários RTE Values:", honorariosRTEValues);
    console.log("Honorários Peric Values:", honorariosPericValues);

    // Soma dos valores dos arrays de honorários
    let honorariosRTEValuesSum = honorariosRTEValues.reduce((acc, val) => {
        let numVal = parseBrazilianNumber(val);
        return !isNaN(numVal) ? acc + numVal : acc;
    }, 0);

    let honorariosPericValuesSum = honorariosPericValues.reduce((acc, val) => {
        let numVal = parseBrazilianNumber(val);
        return !isNaN(numVal) ? acc + numVal : acc;
    }, 0);

    // Log das somas dos honorários
    console.log("Soma Honorários RTE:", honorariosRTEValuesSum);
    console.log("Soma Honorários Peric:", honorariosPericValuesSum);

    // Soma Total
    let totalSum = 0;
    tableRows.forEach(row => {
        let numericValue = parseBrazilianNumber(row.value);
        if (!isNaN(numericValue)) {
            if (["PRINCIPAL", "FGTS (A DEPOSITAR)"].includes(row.description)) {
                totalSum += numericValue;
            }
        }
    });

    // Adiciona a linha "INSS TOTAL" imediatamente abaixo de "SAT"
    tableRows.forEach(row => {
        let tableRow = table.insertRow(-1);
        tableRow.insertCell(0).innerText = row.description;
        tableRow.insertCell(1).innerText = row.value;

        if (row.description === "SAT") {
            let inssTotalRow = table.insertRow(-1);
            inssTotalRow.insertCell(0).innerText = "INSS TOTAL";
            inssTotalRow.insertCell(1).innerText = formatBrazilianCurrency(inssRte + inssRda + satValue);
        }
    });

    // Adiciona a linha TOTAL ao final da tabela
    let totalRow = table.insertRow(-1);
    totalRow.insertCell(0).innerHTML = "<b>TOTAL</b>";

    // Adiciona a soma das variáveis ao lado de TOTAL
    let totalVariablesSum = principalValue + fgtsDepositoValue + inssRte + inssRda + satValue + irpfDevidoValue + 
                            honorariosRTEValuesSum + 
                            honorariosPericValuesSum + 
                            (custasJudiciaisValues.length > 0 ? custasJudiciaisValues[custasJudiciaisValues.length - 1] : 0);

    totalRow.insertCell(1).innerText = formatBrazilianCurrency(totalVariablesSum);

    // Log para verificar a soma final
    console.log("Soma Total das Variáveis:", totalVariablesSum);
}




function findFourthLastNumericValue(items, endIndex) {
    let numericValues = [];

    for (let i = endIndex - 1; i >= 0; i--) {
        let text = items[i].str;
        let numeric = parseBrazilianNumber(text);
        if (!isNaN(numeric)) {
            numericValues.push(numeric);
        }
        if (numericValues.length === 4) {
            break;
        }
    }

    if (numericValues.length >= 4) {
        return parseFloat(numericValues[3]);
    } else {
        return null;
    }
}

function findAntepenultimateNumericValue(items, endIndex) {
    let numericValues = [];

    for (let i = endIndex - 1; i >= 0; i--) {
        let text = items[i].str;
        let numeric = parseBrazilianNumber(text);
        if (!isNaN(numeric)) {
            numericValues.push(numeric);
        }
        if (numericValues.length === 3) {
            break;
        }
    }

    if (numericValues.length >= 3) {
        return parseFloat(numericValues[2]);
    } else {
        return null;
    }
}

function findRightCellValue(items, startIndex) {
    for (let i = startIndex + 1; i < items.length; i++) {
        let text = items[i].str;
        let numeric = parseBrazilianNumber(text);
        console.log("Checking value: ", text, " Parsed: ", numeric); // Adicione esta linha para verificar os valores
        if (!isNaN(numeric)) {
            return parseFloat(numeric);
        }
    }
    return null;
}

function parseBrazilianNumber(text) {
    console.log("Parsing text: ", text); // Adicione esta linha para verificar o texto
    text = text.replace(/\./g, '').replace(',', '.');
    let number = parseFloat(text);
    console.log("Parsed number: ", number); // Adicione esta linha para verificar o número convertido
    return number;
}

function formatBrazilianCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

let tableRows = []; // Array para armazenar as linhas da tabela

function addRowToTable(description, value) {
    console.log("Adding row to table. Description: ", description, " Value: ", value); // Adicione esta linha para verificar os valores antes de adicionar à tabela            

    let table = document.getElementById('resultsTable');
    if (!table) {
        table = document.createElement('table');
        table.id = 'resultsTable';
        table.border = '1';
        let header = table.createTHead();
        let headerRow = header.insertRow(0);
        //headerRow.insertCell(0).innerText = "Descrição";
        //headerRow.insertCell(1).innerText = "Valor";
        document.body.appendChild(table);
    }

    // Verifica se a descrição já existe no array e remove a primeira ocorrência
    let existingRowIndex = tableRows.findIndex(row => row.description === description);
    if (existingRowIndex !== -1) {
        tableRows.splice(existingRowIndex, 1);
    }

    // Adiciona a linha no array
    tableRows.push({ description, value });

    // Ordena as linhas na ordem desejada
    const order = ["PRINCIPAL", "FGTS (A DEPOSITAR)", "INSS RTE", "INSS RDA", "SAT", "INSS TOTAL", "IR", "HONOR P/ RTE", "HONOR P/ PERIC", "HONOR P/ RDA", "CUSTAS"];
    tableRows.sort((a, b) => order.indexOf(a.description) - order.indexOf(b.description));

    // Remove todas as linhas da tabela e adiciona novamente na ordem correta
    while (table.rows.length > 1) {
        table.deleteRow(1);
    }

    // Adiciona as linhas na tabela na ordem correta
    let totalSum = 0; // Variável para armazenar a soma dos valores
    tableRows.forEach(row => {
        let tableRow = table.insertRow(-1);
        tableRow.insertCell(0).innerText = row.description;
        tableRow.insertCell(1).innerText = row.value;

        // Verifica se o valor é numérico
        let numericValue = parseBrazilianNumber(row.value);
        if (!isNaN(numericValue)) {
            // Atualiza a soma dos valores, considerando apenas PRINCIPAL e FGTS (A DEPOSITAR)
            if (["PRINCIPAL", "FGTS (A DEPOSITAR)"].includes(row.description)) {
                totalSum += numericValue;
            }
            console.log(row.description + ": " + row.value + " (Numérico)");
        } else {
            console.log(row.description + ": " + row.value + " (NaN)");
        }

        // Adiciona a linha "INSS TOTAL" imediatamente abaixo de "SAT"
        if (row.description === "SAT") {
            let inssTotalRow = table.insertRow(-1);
            inssTotalRow.insertCell(0).innerText = "INSS TOTAL";
            inssTotalRow.insertCell(1).innerText = formatBrazilianCurrency(inssRte + inssRda + satValue);
        }
    });

    // Adiciona a linha TOTAL ao final da tabela
    let totalRow = table.insertRow(-1);
    totalRow.insertCell(0).innerHTML = "<b>TOTAL</b>";

    // Adiciona a soma das variáveis ao lado de TOTAL
                            
    let totalVariablesSum = principalValue + fgtsDepositoValue + inssRte + inssRda + satValue + irpfDevidoValue + 
                        (honorariosRTEValues.length > 0 ? honorariosRTEValues.reduce((acc, val) => acc + val, 0) : 0) + 
                        (honorariosPericValues.length > 0 ? honorariosPericValues.reduce((acc, val) => acc + val, 0) : 0) + 
                        (custasJudiciaisValues.length > 0 ? custasJudiciaisValues[custasJudiciaisValues.length - 1] : 0);

                        console.log("Valores de Honorários RTE:", honorariosRTEValues);
                        console.log("Soma dos Honorários RTE:", honorariosRTEValues.reduce((acc, val) => acc + val, 0));

                        console.log("Valores de Honorários Peric:", honorariosPericValues);
                        console.log("Soma dos Honorários Peric:", honorariosPericValues.reduce((acc, val) => acc + val, 0));

                        console.log("Soma dos honorários:", honorariosRTEValues + honorariosPericValues);




    totalRow.insertCell(1).innerText = formatBrazilianCurrency(totalVariablesSum);    
    
}


function getNewLabel(text, counter) {
    switch (text) {
        case "LÍQUIDO DEVIDO AO RECLAMANTE":
            return "PRINCIPAL";
        case "DEPÓSITO FGTS":
            return "FGTS (A DEPOSITAR)";
        case "HONORÁRIOS LÍQUIDOS PARA":
            switch (counter) {
                case 1:
                    return "HONOR P/ RTE";
                case 2:
                    return "HONOR P/ PERIC";
                case 3:
                    return "HONOR P/ RDA";
                default:
                    return "HONOR P/ OUTRO";
            }
        case "IRPF DEVIDO PELO RECLAMANTE":
            return "IR";
        case "CUSTAS JUDICIAIS DEVIDAS":
            return "CUSTAS";
        default:
            return text;
    }
}

// Função para copiar a tabela para a área de transferência
function copyTableToClipboard() {
    let table = document.getElementById('resultsTable');
    if (!table) {
        alert("Nenhuma tabela para copiar.");
        return;
    }

    let range, selection;
    if (document.createRange) {
        range = document.createRange();
        range.selectNode(table);
        selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        try {
            document.execCommand('copy');
            
        } catch (err) {
            console.error('Erro ao copiar a tabela:', err);
            
        }

        selection.removeAllRanges(); // Limpa a seleção
    } else {
        alert('O navegador não suporta a funcionalidade de cópia.');
    }
}

// Adiciona um evento de clique ao botão
document.getElementById('copyButton').addEventListener('click', copyTableToClipboard);

