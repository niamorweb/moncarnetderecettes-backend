import { Injectable, Logger } from '@nestjs/common';

interface LuluShippingAddress {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state_code?: string;
  country_code: string;
  postcode: string;
  phone_number: string;
}

interface LuluPrintJobParams {
  coverPdfUrl: string;
  interiorPdfUrl: string;
  shippingAddress: LuluShippingAddress;
  contactEmail: string;
  externalId: string;
  title: string;
  quantity?: number;
  shippingLevel?: string;
}

interface LuluPrintJobResponse {
  id: number;
  status: { name: string };
  line_items: Array<{
    id: number;
    tracking_id?: string;
    tracking_urls?: string[];
  }>;
}

@Injectable()
export class LuluService {
  private readonly logger = new Logger(LuluService.name);
  private readonly baseUrl = 'https://api.lulu.com';
  private readonly tokenUrl = `${this.baseUrl}/auth/realms/glasstree/protocol/openid-connect/token`;

  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  // A5 casewrap hardcover, full color, premium, 80# coated white, matte finish
  private readonly podPackageId = '0583X0827FCPRECW080CW444MXX';

  private async getAccessToken(): Promise<string> {
    // Retourner le token en cache s'il est encore valide (marge de 60s)
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60_000) {
      return this.cachedToken;
    }

    const encodedCredentials =
      process.env.LULU_API_ENCODED_CLIENT_AND_SECRET_KEY!;

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: encodedCredentials,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Erreur auth Lulu: ${response.status} - ${errorBody}`);
      throw new Error(`Lulu auth error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    this.logger.log('Token Lulu obtenu avec succès');
    return this.cachedToken!;
  }

  /**
   * Calcule la largeur du spine en mm basée sur le nombre de pages.
   * Pour du papier 80# coated white : ~0.0572mm par feuille (2 pages).
   */
  getSpineWidth(pageCount: number): number {
    return pageCount * 0.0572;
  }

  /**
   * Ajuste le pageCount : minimum 24 pages pour Lulu, doit être pair.
   */
  normalizePageCount(rawCount: number): number {
    const min = 48;
    const max = 800;
    let count = Math.max(rawCount, min);
    if (count % 2 !== 0) {
      count += 1;
    }
    return Math.min(count, max);
  }

  async createPrintJob(
    params: LuluPrintJobParams,
  ): Promise<LuluPrintJobResponse> {
    const token = await this.getAccessToken();

    const body = {
      contact_email: params.contactEmail,
      external_id: params.externalId,
      line_items: [
        {
          pod_package_id: this.podPackageId,
          quantity: params.quantity || 1,
          title: params.title,
          cover: { source_url: params.coverPdfUrl },
          interior: { source_url: params.interiorPdfUrl },
        },
      ],
      shipping_level: params.shippingLevel || 'MAIL',
      shipping_address: params.shippingAddress,
    };

    this.logger.log(
      `Envoi print job Lulu: externalId=${params.externalId}, package=${this.podPackageId}`,
    );
    this.logger.log(`Cover PDF URL: ${params.coverPdfUrl}`);
    this.logger.log(`Interior PDF URL: ${params.interiorPdfUrl}`);
    this.logger.log(`Payload Lulu: ${JSON.stringify(body, null, 2)}`);

    // Vérifier que les PDFs sont accessibles
    for (const url of [params.coverPdfUrl, params.interiorPdfUrl]) {
      try {
        const pdfCheck = await fetch(url, { method: 'HEAD' });
        this.logger.log(
          `PDF accessible (${url.split('/').pop()}): ${pdfCheck.status} ${pdfCheck.statusText} (Content-Type: ${pdfCheck.headers.get('content-type')}, Size: ${pdfCheck.headers.get('content-length')})`,
        );
        if (!pdfCheck.ok) {
          this.logger.warn(
            `PDF non accessible publiquement (${pdfCheck.status}) - Lulu ne pourra pas le télécharger`,
          );
        }
      } catch (e) {
        this.logger.error(`Erreur vérification PDF ${url}: ${e.message}`);
      }
    }

    const response = await fetch(`${this.baseUrl}/print-jobs/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Erreur Lulu API: ${response.status} - ${errorBody}`);
      throw new Error(`Lulu API error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    this.logger.log(
      `Print job Lulu créé: id=${result.id}, status=${result.status?.name}`,
    );
    return result;
  }

  async getPrintJobStatus(printJobId: string): Promise<any> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}/print-jobs/${printJobId}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Lulu API error: ${response.status}`);
    }

    return response.json();
  }
}
