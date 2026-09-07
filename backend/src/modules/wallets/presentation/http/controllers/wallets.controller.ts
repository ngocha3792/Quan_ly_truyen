import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUserId, RequirePermissions } from '@/common/decorators';
import { PermissionCode } from '@/common/enums';

import {
  GetMyWalletQuery,
  GetMyWalletQueryHandler,
  ListMyWalletTransactionsQuery,
  ListMyWalletTransactionsQueryHandler,
  type WalletBalanceResultDto,
  type WalletTransactionPageResultDto,
} from '../../../application';
import { MonetizationEnabledGuard } from '../guards';
import { ListWalletTransactionsRequest } from '../requests';

@Controller('wallet/me')
@UseGuards(MonetizationEnabledGuard)
@RequirePermissions(PermissionCode.WALLET_READ_SELF)
export class WalletsController {
  constructor(
    private readonly getMyWalletQuery: GetMyWalletQueryHandler,
    private readonly listMyTransactionsQuery: ListMyWalletTransactionsQueryHandler,
  ) {}

  @Get()
  getMyWallet(
    @CurrentUserId() userId: string | undefined,
  ): Promise<WalletBalanceResultDto> {
    return this.getMyWalletQuery.execute(new GetMyWalletQuery(userId));
  }

  @Get('transactions')
  listMyTransactions(
    @CurrentUserId() userId: string | undefined,
    @Query() request: ListWalletTransactionsRequest,
  ): Promise<WalletTransactionPageResultDto> {
    return this.listMyTransactionsQuery.execute(
      new ListMyWalletTransactionsQuery(userId, request.page, request.pageSize),
    );
  }
}
