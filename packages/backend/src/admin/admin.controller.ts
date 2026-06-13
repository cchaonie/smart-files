import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users with usage stats' })
  listUsers() {
    return this.adminService.listUsers();
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Reset a user password (cannot reset own)' })
  resetPassword(@Param('id') id: string, @Request() req: any) {
    return this.adminService.resetPassword(id, req.user.id);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change user role (admin/user)' })
  changeRole(
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.adminService.changeRole(id, role);
  }

  @Get('users/:id/usage')
  @ApiOperation({ summary: 'Get storage usage for a user' })
  getUserUsage(@Param('id') id: string) {
    return this.adminService.getUserUsage(id);
  }
}
