import { Injectable, BadRequestException } from '@nestjs/common';
import { ImageService } from './image.service';
import { AutomatorService } from './automator.service';

type OrchestratorKind = 'automator' | 'manual_analyzer';

interface AutomatorPayload {
  img: string;                 // base64 (data URL ou cru)
  form: any;                   // array/form
  type_balance?: any;          // BalanceType (opcional)
  fromBalanceId?: number;      // opcional
}

interface ManualAnalyzerPayload {
  img: string;                 // base64
}

@Injectable()
export class OrchestratorService {
  constructor(
    private readonly imageService: ImageService,
    private readonly automatorService: AutomatorService,
  ) {}

  async handle(
    userId: string,
    kind: OrchestratorKind,
    data: any,
  ): Promise<any> {
    if (!kind) throw new BadRequestException('Kind não informado');
    if (!data?.img) throw new BadRequestException('Imagem não informada');

    const publicUrl = await this.tryResolveImage(data.img);

    switch (kind) {
      case 'automator': {
        const payload = data as AutomatorPayload;
        return this.handleAutomator(userId, { ...payload, img: publicUrl });
      }
      case 'manual_analyzer': {
        const payload = data as ManualAnalyzerPayload;
        return this.handleManualAnalyzer({ ...payload, img: publicUrl });
      }
      default:
        throw new BadRequestException(`Kind inválido: ${kind}`);
    }
  }

  private async tryResolveImage(base64: string): Promise<string> {
    try {
      const saved = await this.imageService.saveTempBase64(base64);
      return saved.publicUrl;
    } catch {
      throw new BadRequestException('Imagem não pôde ser processada.');
    }
  }

  private async handleAutomator(
    userId: string,
    payload: AutomatorPayload & { img: string },
  ) {
    const { img, form, type_balance, fromBalanceId } = payload;

    if (!Array.isArray(form) || !form?.[0]?.ativo) {
      throw new BadRequestException('Dados inválidos. Verifique os campos do formulário.');
    }

    return this.automatorService.start(userId, {
      img,
      form,
      type_balance,
      fromBalanceId,
    });
  }

  private async handleManualAnalyzer(
    payload: ManualAnalyzerPayload & { img: string },
  ) {
    return { ok: true, img: payload.img };
  }
}
