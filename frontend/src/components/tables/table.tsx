import { Center, Group, ScrollArea, Table, Text, UnstyledButton } from '@mantine/core';
import { HiSortAscending } from '@react-icons/all-files/hi/HiSortAscending';
import { HiSortDescending } from '@react-icons/all-files/hi/HiSortDescending';
import { MdSort } from '@react-icons/all-files/md/MdSort';
import React, { useState } from 'react';

import classes from './table.module.css';

export interface TableState {
  sortField: string;
  reversed: boolean;
  setReversed: any;
  setSortField: any;
  pageSize: number;
  page: any;
  setPage: any;
}

export interface ThProps {
  children: React.ReactNode;
  state: TableState;
  field: string;
  visibleFrom?: string;
  align?: 'left' | 'right';
  width?: string;
}

export const setSorting = (state: TableState, newSortField: string) => {
  if (newSortField === state.sortField) {
    state.setReversed(!state.reversed);
  } else {
    state.setSortField(newSortField);
  }
};

export const getTableState = (
  initial_sort_field: string,
  initial_sort_direction: boolean = true
) => {
  const [reversed, setReversed] = useState(initial_sort_direction);
  const [sortField, setSortField] = useState(initial_sort_field);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  return {
    sortField,
    setSortField,
    reversed,
    setReversed,
    pageSize,
    page,
    setPage,
  };
};

export function tableStateToPagination(tableState: TableState) {
  const sort_direction: 'asc' | 'desc' = tableState.reversed ? 'asc' : 'desc';
  return {
    limit: tableState.pageSize,
    offset: tableState.pageSize * (tableState.page - 1),
    sort_by: tableState.sortField,
    sort_direction,
  };
}

export function sortTableEntries(r1: any, r2: any, tableState: TableState) {
  const order = r1[tableState.sortField] > r2[tableState.sortField];
  return (tableState.reversed ? order : !order) ? 1 : -1;
}

export function getSortIcon(sorted: boolean, reversed: boolean, size: number = 14) {
  if (!sorted) return <MdSort size={size} />;
  if (reversed) return <HiSortDescending size={size} />;
  return <HiSortAscending size={size} />;
}

export function ThSortable({ children, field, visibleFrom, state, align, width }: ThProps) {
  const sorted = state.sortField === field;
  const onSort = () => setSorting(state, field);
  return (
    <Table.Th className={classes.th} visibleFrom={visibleFrom} style={{ width }}>
      <UnstyledButton onClick={onSort} className={classes.control} style={{ fontSize: 'inherit' }}>
        <Group
          justify={align === 'right' ? 'flex-end' : 'apart'}
          pr={align === 'right' ? 'md' : 0}
          gap={4}
          wrap="nowrap"
        >
          <Text fw={800} inherit ml={align === 'right' ? 0 : '0.5rem'} my="0.25rem">
            {children}
          </Text>
          {sorted && (
            <Center className={classes.icon}>{getSortIcon(sorted, state.reversed)}</Center>
          )}
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

export function ThNotSortable({
  children,
  visibleFrom,
  align,
  width,
}: {
  children: React.ReactNode;
  visibleFrom?: string;
  align?: 'left' | 'right';
  width?: string;
}) {
  return (
    <Table.Th className={classes.th} visibleFrom={visibleFrom} style={{ width }}>
      <Group
        justify={align === 'right' ? 'flex-end' : 'apart'}
        ml={align === 'right' ? 0 : '20px'}
        pr={align === 'right' ? 'md' : 0}
      >
        <Text fw={800} inherit my="0.25rem">
          {children}
        </Text>
      </Group>
    </Table.Th>
  );
}

export default function TableLayout(props: any) {
  return (
    <>
      <ScrollArea>
        <Table
          horizontalSpacing="md"
          verticalSpacing="xs"
          striped
          highlightOnHover
          layout="fixed"
          {...props}
        >
          {props.children}
        </Table>
      </ScrollArea>
    </>
  );
}
