import { Injectable, Logger } from '@nestjs/common';

interface GelatoShippingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postCode: string;
  country: string;
  email: string;
  phone?: string;
}

interface GelatoOrderParams {
  coverPdfUrl: string;
  interiorPdfUrl: string;
  shippingAddress: GelatoShippingAddress;
  printOptions: {
    coverType: string;
    paperType: string;
    finishType: string;
  };
  orderRefId: string;
  customerRefId: string;
  isDraft?: boolean;
  pageCount: number;
}

interface GelatoOrderResponse {
  id: string;
  orderReferenceId: string;
  status: string;
}

@Injectable()
export class GelatoService {
  private readonly logger = new Logger(GelatoService.name);
  private readonly baseUrl = 'https://order.gelatoapis.com/v4';

  // Photobook hardcover 210x280mm, coated silk, matt lamination
  private readonly productUid =
    'photobooks-hardcover_pf_210x280-mm-8x11-inch_pt_170-gsm-65lb-coated-silk_cl_4-4_ccl_4-4_bt_glued-left_ct_matt-lamination_prt_1-0_cpt_130-gsm-65-lb-cover-coated-silk_ver';

  private get apiKey(): string {
    return process.env.GELATO_API_KEY!;
  }

  /**
   * Ajuste le pageCount aux valeurs acceptées par Gelato :
   * pair, minimum 28, maximum 250.
   */
  normalizePageCount(rawCount: number): number {
    const min = 28;
    const max = 250;
    let count = Math.max(rawCount, min);
    if (count % 2 !== 0) {
      count += 1;
    }
    return Math.min(count, max);
  }

  async createOrder(params: GelatoOrderParams): Promise<GelatoOrderResponse> {
    const pageCount = this.normalizePageCount(params.pageCount);

    const body = {
      orderType: 'draft',
      orderReferenceId: params.orderRefId,
      customerReferenceId: params.customerRefId,
      currency: 'EUR',
      shipmentMethodUid: 'standard',
      shippingAddress: params.shippingAddress,
      items: [
        {
          itemReferenceId: `item-${params.orderRefId}`,
          productUid: this.productUid,
          pageCount,
          quantity: 1,
          files: [
            {
              type: 'cover',
              url: params.coverPdfUrl,
            },
            {
              type: 'content',
              url: params.interiorPdfUrl,
            },
          ],
        },
      ],
    };

    const mode = params.isDraft ? 'draft' : 'order';
    this.logger.log(
      `Envoi ${mode} Gelato: orderRef=${params.orderRefId}, product=${this.productUid}, pageCount=${pageCount} (raw: ${params.pageCount})`,
    );
    this.logger.log(`Cover PDF URL: ${params.coverPdfUrl}`);
    this.logger.log(`Interior PDF URL: ${params.interiorPdfUrl}`);
    this.logger.log(`Payload Gelato: ${JSON.stringify(body, null, 2)}`);

    // Vérifier que les PDFs sont accessibles
    for (const url of [params.coverPdfUrl, params.interiorPdfUrl]) {
      try {
        const pdfCheck = await fetch(url, { method: 'HEAD' });
        this.logger.log(
          `PDF accessible (${url.split('/').pop()}): ${pdfCheck.status} ${pdfCheck.statusText} (Content-Type: ${pdfCheck.headers.get('content-type')}, Size: ${pdfCheck.headers.get('content-length')})`,
        );
        if (!pdfCheck.ok) {
          this.logger.warn(
            `PDF non accessible publiquement (${pdfCheck.status}) - Gelato ne pourra pas le télécharger`,
          );
        }
      } catch (e) {
        this.logger.error(`Erreur vérification PDF ${url}: ${e.message}`);
      }
    }

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Erreur Gelato API: ${response.status} - ${errorBody}`);
      throw new Error(`Gelato API error: ${response.status} - ${errorBody}`);
    }

    const result = await response.json();
    this.logger.log(
      `${mode} Gelato créé: id=${result.id}, status=${result.fulfillmentStatus || result.status}`,
    );
    return result;
  }

  /**
   * Récupère les dimensions du cover spread auprès de l'API Gelato.
   */
  async getCoverDimensions(pageCount: number) {
    const url = `https://product.gelatoapis.com/v3/products/${this.productUid}/cover-dimensions?pageCount=${pageCount}`;

    this.logger.log(
      `Récupération cover dimensions: product=${this.productUid}, pages=${pageCount}`,
    );

    const response = await fetch(url, {
      headers: { 'X-API-KEY': this.apiKey },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `Erreur Gelato cover-dimensions: ${response.status} - ${errorBody}`,
      );
      throw new Error(
        `Gelato cover-dimensions error: ${response.status} - ${errorBody}`,
      );
    }

    const data = await response.json();
    this.logger.log(
      `Cover dimensions: spread=${data.wraparoundInsideSize.width}x${data.wraparoundInsideSize.height}mm, spine=${data.spineSize.width}mm`,
    );

    return {
      spreadWidth: data.wraparoundInsideSize.width as number,
      spreadHeight: data.wraparoundInsideSize.height as number,
      frontWidth: data.contentFrontSize.width as number,
      frontHeight: data.contentFrontSize.height as number,
      frontLeft: data.contentFrontSize.left as number,
      frontTop: data.contentFrontSize.top as number,
      backWidth: data.contentBackSize.width as number,
      backHeight: data.contentBackSize.height as number,
      backLeft: data.contentBackSize.left as number,
      backTop: data.contentBackSize.top as number,
      spineWidth: data.spineSize.width as number,
      spineHeight: data.spineSize.height as number,
      spineLeft: data.spineSize.left as number,
      spineTop: data.spineSize.top as number,
    };
  }

  async getOrderStatus(gelatoOrderId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/orders/${gelatoOrderId}`, {
      headers: {
        'X-API-KEY': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Gelato API error: ${response.status}`);
    }

    return response.json();
  }
}
