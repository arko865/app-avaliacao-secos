import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import jsPDF from "jspdf";

const ITEMS_SCORABLE = [
  "Depósito/Aéreo: Nos Paletes Mix foi armazenado produtos de uma mesma categoria?",
  "Depósito/Aéreo: Foram eliminadas caixas abertas (incompletas) e/ou contendo diversos itens mesclados?",
  "Depósito/Aéreo: Foram organizados os Paletes de uma mesma categoria no seu corredor?",
  "Depósito: Para os Paletes Full foram organizados com amarração única e placas contendo identificação?",
  "Depósito: Área segregada do PAR foi organizada respeitando agrupamento por códigos?",
  "Depósito/Aéreo: Os Paletes Mix foram organizados separando por códigos?",
  "Depósito/Aéreo: Produtos do aéreo foram organizados respeitando agrupamento por categoria e código?",
  "Área de Venda: Foram eliminadas caixas nas gôndolas?",
  "Área de Venda: Foi organizada a caixaria da última prateleira com descrição voltada para fora?",
  "Área de Venda: Foi reduzido o abastecimento dos produtos de Baixo e Médio Giro em D-5 e produtos de Alto Giro em D-1?",
  "Área de Venda: Mercadorias puxadas para frente facilitando visualização?",
  "Área de Venda: Produtos agrupados por códigos nas prateleiras?",
  "Área de Venda: Foi deixado 1 cm de separação entre grupos?",
  "Área de Venda: Produtos organizados em uma única forma (não misturar posições)?",
  "Área de Venda: Pontas de gôndola organizadas sem unidades soltas e sem fundo falso?",
  "Área de Venda: Produtos em peg board reduzidos e empurrados para trás?",
  "Área de Venda PAR: Garrafas de bebidas em suas embalagens corretas.",
  "Área de Venda PAR: Produtos em vitrines organizados corretamente."
];

const INFORMATIVE_OPTIONS = {
  produtosIdentificados: [
    "Sim, estão identificados",
    "Não existem",
    "Existem, mas NÃO estão identificados corretamente",
  ],
  impactoMercadoria: [
    "Sim, não há espaço para movimentação",
    "Necessidade mão de obra extra",
    "Esta de acordo com o esperado",
  ],
};

const STATUS_THRESHOLD = 84.5;

const initialItems = ITEMS_SCORABLE.map((description, index) => ({
  id: index + 1,
  description,
  areaAvaliada: "",
  naoConformes: "",
  observacao: "",
}));

function clampPercent(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function sanitizeFileName(name) {
  return (name || "relatorio-avaliacao")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase() || "relatorio-avaliacao";
}

function runSelfTests() {
  const cases = [
    clampPercent(-10) === 0,
    clampPercent(150) === 100,
    formatPercent(84.5) === "84.5%",
    sanitizeFileName("Loja São José / 01") === "loja-sao-jose-01",
  ];

  if (cases.some((passed) => !passed)) {
    console.warn("Alguns testes internos falharam.");
  }
}

runSelfTests();

export default function App() {
  const [form, setForm] = useState({
    nomeLoja: "",
    visita: "1ª Visita",
    coordArko: "",
    gerenteLoja: "",
    gerenteAcompanhou: true,
    data: new Date().toISOString().slice(0, 10),
    horaVisita: "",
    produtosIdentificados: "",
    impactoMercadoria: "",
  });

  const [items, setItems] = useState(initialItems);

  const summary = useMemo(() => {
    let totalAreas = 0;
    let totalNaoConformes = 0;

    const rows = items.map((item) => {
      const areaAvaliada = Math.max(0, Number(item.areaAvaliada) || 0);
      const naoConformes = Math.min(Math.max(0, Number(item.naoConformes) || 0), areaAvaliada);
      const itemScore = areaAvaliada > 0
        ? clampPercent(((areaAvaliada - naoConformes) / areaAvaliada) * 100)
        : 0;

      totalAreas += areaAvaliada;
      totalNaoConformes += naoConformes;

      return { ...item, areaAvaliada, naoConformes, itemScore };
    });

    const notaFinal = totalAreas > 0
      ? clampPercent(((totalAreas - totalNaoConformes) / totalAreas) * 100)
      : 0;

    const itensCriticos = rows.filter((r) => r.naoConformes > 0).length;
    const statusLoja = notaFinal >= STATUS_THRESHOLD ? "Aprovada para inventário" : "Reprovada";
    const statusClasses = notaFinal >= STATUS_THRESHOLD
      ? "bg-green-100 text-green-900"
      : "bg-red-900 text-white";

    return {
      rows,
      totalAreas,
      totalNaoConformes,
      notaFinal,
      itensCriticos,
      statusLoja,
      statusClasses,
    };
  }, [items]);

  const handleItemChange = (id, field, value) => {
    setItems((prev) => prev.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  };

  const exportPDF = () => {
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 12;
      const bottomMargin = 24;
      const contentWidth = pageWidth - marginX * 2;
      let y = 14;

      const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Relatório de Avaliação de Inventário", pageWidth / 2, 16, { align: "center" });
        doc.setDrawColor(210);
        doc.line(marginX, 22, pageWidth - marginX, 22);
        y = 28;
      };

      const drawFooter = () => {
        const footerY = pageHeight - 18;
        const lineWidth = 65;

        doc.setDrawColor(120);
        doc.line(marginX, footerY, marginX + lineWidth, footerY);
        doc.line(pageWidth - marginX - lineWidth, footerY, pageWidth - marginX, footerY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text("Assinatura Arko", marginX + lineWidth / 2, footerY + 5, { align: "center" });
        doc.text("Assinatura Cliente", pageWidth - marginX - lineWidth / 2, footerY + 5, { align: "center" });
      };

      const ensureSpace = (needed = 10) => {
        if (y + needed > pageHeight - bottomMargin) {
          drawFooter();
          doc.addPage();
          drawHeader();
        }
      };

      const writeWrapped = (label, value = "-", indent = 0, gap = 5) => {
        const safeText = `${label}${value || "-"}`;
        const lines = doc.splitTextToSize(safeText, contentWidth - indent);
        ensureSpace(lines.length * gap + 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(lines, marginX + indent, y);
        y += lines.length * gap + 2;
      };

      const writeSectionTitle = (title) => {
        ensureSpace(8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(title, marginX, y);
        y += 6;
      };

      drawHeader();

      writeSectionTitle("Dados Gerais");
      writeWrapped("Loja: ", form.nomeLoja);
      writeWrapped("Visita: ", form.visita);
      writeWrapped("Coordenador Arko: ", form.coordArko);
      writeWrapped("Gerente da Loja: ", form.gerenteLoja);
      writeWrapped("Gerente acompanhou validação: ", form.gerenteAcompanhou ? "Sim" : "Não");
      writeWrapped("Data: ", form.data);
      writeWrapped("Hora da visita: ", form.horaVisita);

      writeSectionTitle("Resumo Final");
      writeWrapped("Nota final: ", formatPercent(summary.notaFinal));
      writeWrapped("Status: ", summary.statusLoja);
      writeWrapped("Áreas avaliadas: ", String(summary.totalAreas));
      writeWrapped("Áreas não conformes: ", String(summary.totalNaoConformes));
      writeWrapped("Itens com não conformidade: ", String(summary.itensCriticos));

      writeSectionTitle("Itens Avaliados");
      summary.rows.forEach((row) => {
        ensureSpace(28);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`Item ${row.id} — ${formatPercent(row.itemScore)}`, marginX, y);
        y += 5;
        writeWrapped("Descrição: ", row.description, 2);
        writeWrapped("Áreas avaliadas: ", String(row.areaAvaliada), 2);
        writeWrapped("Áreas não conformes: ", String(row.naoConformes), 2);
        writeWrapped("Observações: ", row.observacao, 2);
        y += 2;
      });

      writeSectionTitle("Itens Informativos (Sem Nota)");
      writeWrapped("Existem produtos que não deverão ser contados no Inventário? ", form.produtosIdentificados);
      writeWrapped("A quantidade de mercadorias na loja pode inviabilizar ou atrasar o inventário? ", form.impactoMercadoria);

      drawFooter();
      doc.save(`${sanitizeFileName(form.nomeLoja)}.pdf`);
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      alert("Não foi possível gerar o PDF. Tente novamente após preencher os dados.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Avaliação de Inventário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Nome da loja</Label>
                  <Input value={form.nomeLoja} onChange={(e) => setForm({ ...form, nomeLoja: e.target.value })} />
                </div>
                <div>
                  <Label>Visita</Label>
                  <Input value={form.visita} onChange={(e) => setForm({ ...form, visita: e.target.value })} />
                </div>
                <div>
                  <Label>Coord. Arko</Label>
                  <Input value={form.coordArko} onChange={(e) => setForm({ ...form, coordArko: e.target.value })} />
                </div>
                <div>
                  <Label>Gerente da loja</Label>
                  <Input value={form.gerenteLoja} onChange={(e) => setForm({ ...form, gerenteLoja: e.target.value })} />
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
                <div>
                  <Label>Hora da visita</Label>
                  <Input type="time" value={form.horaVisita} onChange={(e) => setForm({ ...form, horaVisita: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-4">
                <input
                  type="checkbox"
                  checked={form.gerenteAcompanhou}
                  onChange={(e) => setForm({ ...form, gerenteAcompanhou: e.target.checked })}
                />
                <div className="font-medium">Gerente acompanhou validação</div>
              </div>

              <div>
                <h2 className="font-bold text-lg mb-4">DEPÓSITO / AÉREO (Itens 1–7)</h2>
                {summary.rows.slice(0, 7).map((item) => (
                  <ItemCard key={item.id} item={item} handleItemChange={handleItemChange} />
                ))}
              </div>

              <div>
                <h2 className="font-bold text-lg mb-4">ÁREA DE VENDA (Itens 8–18)</h2>
                {summary.rows.slice(7, 18).map((item) => (
                  <ItemCard key={item.id} item={item} handleItemChange={handleItemChange} />
                ))}
              </div>

              <div>
                <h2 className="font-bold text-lg mb-4">Itens Informativos (Sem Nota)</h2>
                <div className="space-y-5">
                  <div>
                    <Label>Existem produtos que não deverão ser contados no Inventário?</Label>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {INFORMATIVE_OPTIONS.produtosIdentificados.map((label) => (
                        <OptionButton
                          key={label}
                          active={form.produtosIdentificados === label}
                          onClick={() => setForm({ ...form, produtosIdentificados: label })}
                          label={label}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>A quantidade de mercadorias na loja pode inviabilizar ou atrasar o inventário?</Label>
                    <div className="mt-2 flex flex-wrap gap-3">
                      {INFORMATIVE_OPTIONS.impactoMercadoria.map((label) => (
                        <OptionButton
                          key={label}
                          active={form.impactoMercadoria === label}
                          onClick={() => setForm({ ...form, impactoMercadoria: label })}
                          label={label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <Button type="button" onClick={exportPDF}>Exportar PDF</Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 self-start">
          <Card>
            <CardHeader>
              <CardTitle>Resumo Final</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`rounded-xl px-4 py-5 text-center ${summary.statusClasses}`}>
                <div className="text-sm font-semibold uppercase tracking-wide">Resultado da avaliação</div>
                <div className="mt-2 text-3xl font-bold">{formatPercent(summary.notaFinal)}</div>
                <div className="mt-2 text-base font-bold">{summary.statusLoja}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-100 p-4">
                  <div className="text-xs text-slate-500">Áreas avaliadas</div>
                  <div className="text-2xl font-bold">{summary.totalAreas}</div>
                </div>
                <div className="rounded-xl bg-slate-100 p-4">
                  <div className="text-xs text-slate-500">Não conformes</div>
                  <div className="text-2xl font-bold">{summary.totalNaoConformes}</div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-semibold">Faixa de aprovação</div>
                <div className="mt-2 text-sm text-slate-600">0 a 84,4%: reprovada</div>
                <div className="text-sm text-slate-600">84,5 a 100%: aprovada para inventário</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resumo por item</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px] pr-3">
                <div className="space-y-3">
                  {summary.rows.map((item) => {
                    const itemStatusClass = item.itemScore >= STATUS_THRESHOLD
                      ? "bg-green-100 text-green-900"
                      : "bg-red-900 text-white";

                    return (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold">Item {item.id}</div>
                            <div className="mt-1 text-xs text-slate-600">{item.description}</div>
                          </div>
                          <div className={`min-w-[96px] rounded-lg px-3 py-2 text-center ${itemStatusClass}`}>
                            <div className="text-xs font-semibold">Nota</div>
                            <div className="text-sm font-bold">{formatPercent(item.itemScore)}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function OptionButton({ active, onClick, label }) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className="h-auto whitespace-normal text-left"
    >
      {label}
    </Button>
  );
}

function ItemCard({ item, handleItemChange }) {
  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 p-4">
        <div className="flex justify-between gap-3">
          <Badge>Item {item.id}</Badge>
          <span className="font-semibold">{formatPercent(item.itemScore)}</span>
        </div>
        <p className="text-sm">{item.description}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Áreas avaliadas</Label>
            <Input
              type="number"
              min="0"
              value={item.areaAvaliada}
              onChange={(e) => handleItemChange(item.id, "areaAvaliada", e.target.value)}
            />
          </div>
          <div>
            <Label>Áreas não conformes</Label>
            <Input
              type="number"
              min="0"
              value={item.naoConformes}
              onChange={(e) => handleItemChange(item.id, "naoConformes", e.target.value)}
            />
          </div>
        </div>
        <Textarea
          placeholder="Observações"
          value={item.observacao}
          onChange={(e) => handleItemChange(item.id, "observacao", e.target.value)}
        />
      </CardContent>
    </Card>
  );
}
