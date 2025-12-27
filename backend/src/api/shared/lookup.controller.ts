import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { LookupService } from './lookup.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@Controller('shared/lookup')
@UseGuards(JwtAuthGuard)
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get('institutions')
  async getInstitutions(@Query('includeInactive') includeInactive?: string) {
    // For reports, pass ?includeInactive=true to get all institutions
    return this.lookupService.getInstitutions(includeInactive === 'true');
  }

  @Get('batches')
  async getBatches() {
    return this.lookupService.getBatches();
  }

  @Get('industries')
  async getIndustries() {
    return this.lookupService.getIndustries();
  }

  @Get('roles')
  async getRoles() {
    return this.lookupService.getRoles();
  }
}
