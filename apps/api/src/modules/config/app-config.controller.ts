import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AmenityCode, Currency, FALLBACK_RATES } from '@zal/contracts';
import { Public } from '../../common/decorators/public.decorator';

/** Labels live here rather than in the database: they are copy, not data. */
const AMENITY_LABELS: Record<AmenityCode, { en: string; hy: string; ru: string }> = {
  PARKING: { en: 'Parking on site', hy: 'Ավտոկայանատեղի', ru: 'Парковка' },
  CATERING: { en: 'Catering included', hy: 'Սննդի սպասարկում', ru: 'Кейтеринг' },
  SOUND_DJ: { en: 'Sound & DJ booth', hy: 'Ձայն և DJ', ru: 'Звук и DJ' },
  OUTDOOR_TERRACE: { en: 'Outdoor terrace', hy: 'Բացօթյա տեռաս', ru: 'Открытая терраса' },
  AIR_CONDITIONING: { en: 'Air conditioning', hy: 'Օդորակում', ru: 'Кондиционер' },
  DANCE_FLOOR: { en: 'Dance floor', hy: 'Պարահրապարակ', ru: 'Танцпол' },
  PHOTOGRAPHY_ALLOWED: { en: 'Photography allowed', hy: 'Լուսանկարչություն', ru: 'Фотосъёмка' },
  WHEELCHAIR_ACCESS: { en: 'Step-free access', hy: 'Հարմարեցված մուտք', ru: 'Доступная среда' },
  KIDS_AREA: { en: 'Kids area', hy: 'Մանկական անկյուն', ru: 'Детская зона' },
  SMOKING_AREA: { en: 'Smoking area', hy: 'Ծխելու տարածք', ru: 'Зона для курения' },
};

@ApiTags('config')
@Controller('config')
export class AppConfigController {
  /**
   * Display rates, AMD → currency.
   *
   * Served rather than hard-coded in the clients so a rate change does not need
   * an App Store release. The fallback table in @zal/contracts is what a client
   * uses if this call has not landed yet.
   */
  @Public()
  @Get('currency-rates')
  currencyRates(): { base: Currency; rates: Record<string, number>; fetchedAt: string } {
    return {
      base: Currency.AMD,
      rates: FALLBACK_RATES,
      fetchedAt: new Date().toISOString(),
    };
  }

  @Public()
  @Get('amenities')
  amenities(): { code: string; labels: { en: string; hy: string; ru: string } }[] {
    return Object.entries(AMENITY_LABELS).map(([code, labels]) => ({ code, labels }));
  }
}

export function amenityLabel(code: AmenityCode, locale: 'en' | 'hy' | 'ru' = 'en'): string {
  return AMENITY_LABELS[code]?.[locale] ?? code;
}
