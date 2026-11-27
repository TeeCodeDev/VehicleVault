import React from 'react';
import { TcoSummary } from '../../types/index.js';
import { VehicleKpiCards } from './VehicleKpiCards.js';
import { VehicleMonthlyTable } from './VehicleMonthlyTable.js';
import { VehicleFuelPriceStats } from './VehicleFuelPriceStats.js';
import { VehicleTankDistanceStats } from './VehicleTankDistanceStats.js';
import { VehicleSeasonalStatsCard } from './VehicleSeasonalStatsCard.js';
import { PeriodComparisonCard } from './PeriodComparisonCard.js';

interface VehicleAnalyticsViewProps {
  tco: TcoSummary | null;
  includePurchasePrice: boolean;
  includeFixedExpenses: boolean;
  economyUnit: 'l100km' | 'kml';
  setEconomyUnit: (v: 'l100km' | 'kml') => void;
  exportCsv: () => void;
}

export const VehicleAnalyticsView: React.FC<VehicleAnalyticsViewProps> = ({
  tco,
  includePurchasePrice,
  includeFixedExpenses,
  economyUnit,
  setEconomyUnit,
  exportCsv,
}) => {
  return (
    <div className="space-y-6">
      <VehicleKpiCards
        tco={tco}
        includePurchasePrice={includePurchasePrice}
        includeFixedExpenses={includeFixedExpenses}
        economyUnit={economyUnit}
        setEconomyUnit={setEconomyUnit}
      />

      <VehicleMonthlyTable
        tco={tco}
        exportCsv={exportCsv}
      />

      <PeriodComparisonCard monthlyBreakdown={tco?.monthlyBreakdown || []} />

      <VehicleSeasonalStatsCard seasonalStats={tco?.seasonalStats} />

      <VehicleFuelPriceStats tco={tco} />

      <VehicleTankDistanceStats tco={tco} />
    </div>
  );
};

