import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AdminPrizeService } from './admin-prize.service';
import { CreatePrizeDto } from './dto/create-prize.dto';
import { UpdatePrizeDto } from './dto/update-prize.dto';
import { AdminGuard } from '../../shared/guards/admin.guard';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('admin/prizes')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminPrizeController {
  constructor(private readonly adminPrizeService: AdminPrizeService) {}

  @Post()
  create(@Body() createPrizeDto: CreatePrizeDto) {
    return this.adminPrizeService.create(createPrizeDto);
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.adminPrizeService.findAll(paginationDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminPrizeService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePrizeDto: UpdatePrizeDto,
  ) {
    return this.adminPrizeService.update(id, updatePrizeDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminPrizeService.remove(id);
  }
}
