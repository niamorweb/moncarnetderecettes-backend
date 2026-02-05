import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private ai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    this.ai = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
    });
  }

  async extractRecipeFromImage(file: Express.Multer.File): Promise<any> {
    console.log(
      `Analyse image démarrée : ${file.originalname} (${file.mimetype}, ${file.size} o)`,
    );

    const base64Image = file.buffer.toString('base64');

    const recipeSchema: any = {
      type: 'OBJECT',
      properties: {
        nom: { type: 'STRING' },
        portions: { type: 'NUMBER' },
        temps_preparation: {
          type: 'NUMBER',
          description: 'Temps en minutes',
        },
        ingredients: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
        etapes: {
          type: 'ARRAY',
          items: { type: 'STRING' },
        },
      },
      required: ['nom', 'ingredients', 'etapes'],
    };

    try {
      console.log('Requete envoyée');

      const startTime = Date.now();
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.0-flash',
        config: {
          responseMimeType: 'application/json',
          responseSchema: recipeSchema,
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: file.mimetype,
                  data: base64Image,
                },
              },
              {
                text: 'Extrais les informations de cette recette.',
              },
            ],
          },
        ],
      });

      const duration = Date.now() - startTime;

      const textResponse = response.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error('Aucune réponse générée');
      }

      const parsedData =
        typeof textResponse === 'string'
          ? JSON.parse(textResponse)
          : textResponse;

      return { success: true, data: textResponse };
    } catch (error) {
      this.logger.error(
        'Échec extraction recette',
        error instanceof Error ? error.stack : error,
      );

      throw new InternalServerErrorException(
        "Erreur lors de l'analyse de l'image",
      );
    }
  }
}
