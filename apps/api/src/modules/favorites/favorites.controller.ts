import { Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { paginationQuerySchema, toggleFavoriteSchema } from '@zal/contracts';
import { ZodBody, ZodQuery } from '../../common/decorators/zod.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Saved venues — the shortlist' })
  list(@CurrentUser('id') userId: string, @ZodQuery(paginationQuerySchema) query: unknown) {
    return this.favorites.list(userId, query as never);
  }

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Save or unsave a venue' })
  toggle(
    @CurrentUser('id') userId: string,
    @ZodBody(toggleFavoriteSchema) body: { venueId: string },
  ) {
    return this.favorites.toggle(userId, body.venueId);
  }

  @Delete(':venueId')
  remove(@CurrentUser('id') userId: string, @Param('venueId') venueId: string) {
    return this.favorites.remove(userId, venueId);
  }
}
