"use client";

import type { E2eTest } from "core/debuggAIServer/types";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ChevronRightIcon, PlayCircle } from "lucide-react";
import React, { useContext, useEffect, useState } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setCurrentPagination } from "../../redux/slices/e2eTestsSlice";
import { deleteE2eTest, fetchE2eTests, runE2eTest } from "../../redux/thunks/e2eTestsThunks";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

export function E2eTestsTable() {
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const {
    items: tests,
    testsList,
    loading,
    error,
    currentFilters,
    currentPagination,
  } = useAppSelector((state) => state.e2eTests);

  // ✅ Unified data fetcher that reacts to ideMessenger and state changes
  useEffect(() => {
    if (!ideMessenger) {
      console.log("IdeMessenger not ready yet.");
      return;
    }
    dispatch(fetchE2eTests({
      filters: currentFilters,
      pagination: currentPagination,
    }));
  }, [ideMessenger, currentFilters, currentPagination, dispatch]);

  const handlePageChange = (newPage: number) => {
    dispatch(setCurrentPagination({ ...currentPagination, page: newPage }));
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number.parseInt(e.target.value);
    dispatch(setCurrentPagination({ page: 1, pageSize: newSize }));
  };

  const handleRunTest = (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    dispatch(runE2eTest({ uuid }));
  };

  const handleDeleteTest = async (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this test? This action cannot be undone.")) {
      try {
        await dispatch(deleteE2eTest({ uuid })).unwrap();
      } catch (err) {
        console.error("Delete failed:", err);
      }
    }
  };

  const toggleExpand = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setExpandedTest(expandedTest === id ? null : id);
  };

  const totalPages = testsList ? Math.ceil(testsList.count / currentPagination.pageSize) : 0;
  const startItem = testsList ? (currentPagination.page - 1) * currentPagination.pageSize + 1 : 0;
  const endItem = testsList ? Math.min(startItem + currentPagination.pageSize - 1, testsList.count) : 0;

  if (loading && !testsList?.count) return <E2eTestsTableSkeleton />;
  if (error && !testsList?.count) return <div className="p-4 text-red-500">Error: {error}</div>;
  console.log("testsList", testsList);
  console.log("tests", tests);
  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium w-[60%]">Name</th>
              {/* <th className="text-left p-3 font-medium w-[15%]">Project</th> */}
              {/* <th className="text-left p-3 font-medium w-[15%]">Host</th> */}
              <th className="text-left p-3 font-medium w-[30%]">Last Run</th>
              <th className="text-left p-3 font-medium w-[10%]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {testsList?.count === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No tests found</td></tr>
            ) : (
              testsList?.results?.map((test) => (
                <React.Fragment key={test.uuid}>
                  <tr className="hover:bg-muted/50 cursor-pointer">
                    <td className="p-3" onClick={(e) => toggleExpand(e, test.uuid)}>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-5 w-5 flex-shrink-0"
                          onClick={(e) => toggleExpand(e, test.uuid)}>
                          <ChevronRightIcon className={`h-4 w-4 transition-transform ${expandedTest === test.uuid ? "rotate-90" : ""}`} />
                        </Button>
                        <div className="font-medium truncate">{test.name}</div>
                      </div>
                    </td>
                    {/* <td className="p-3"><span className="text-sm">{test.projectName || "—"}</span></td> */}
                    {/* <td className="p-3"><span className="text-sm">{test.host?.name || "—"}</span></td> */}
                    <td className="p-3">
                      <span className="flex items-center gap-2 text-sm">
                        <TestStatusIcon test={test} />
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center space-x-1">
                        <Button variant="success" size="icon" className="h-7 w-7 hover:bg-green-600" onClick={(e) => handleRunTest(e, test.uuid)}><PlayCircle className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                  {expandedTest === test.uuid && (
                    <tr><td colSpan={6} className="p-0"><div className="p-3 bg-muted/20 border-t"><TestDetails test={test} /></div></td></tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing <b>{startItem}</b> to <b>{endItem}</b> of <b>{testsList?.count ?? 0}</b> tests
      </div>
      {/* Pagination */}
      {testsList && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPagination.page - 1)} disabled={currentPagination.page === 1}>Prev</Button>
            <span className="text-sm">{currentPagination.page} / {totalPages}</span>
            <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPagination.page + 1)} disabled={currentPagination.page >= totalPages}>Next</Button>
            <select value={currentPagination.pageSize} onChange={handlePageSizeChange} className="ml-4 p-1 border rounded">
              {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

function TestStatusIcon({ test }: { test: E2eTest }) {
  if (!test.curRun) return null;

  const lastRun = test.curRun?.timestamp ? formatDistanceToNow(parseISO(test.curRun.timestamp), { addSuffix: true }) : "Never";

  if (test.curRun.status === "completed") {
    if (test.curRun.outcome === "pass") {
      return <div className="text-green-600" ><span title="Passed">✓</span> {lastRun}</div>;
    } else {
      return <div className="text-red-500" ><span title="Failed">✗</span> {lastRun}</div>;
    }
  }
  return null;
}

function TestDetails({ test }: { test: E2eTest }) {
  return (
    <div className="space-y-4">
      <div><h3 className="font-medium mb-1">Description</h3><p className="text-sm text-muted-foreground">{test.description || "No description"}</p></div>
    </div>
  );
}

function E2eTestsTableSkeleton() {
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="bg-muted/50 p-3">
        <div className="grid grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      </div>
      <div className="divide-y">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-3">
            <div className="grid grid-cols-6 gap-4">
              {[...Array(6)].map((_, j) => <Skeleton key={j} className="h-6 w-full" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
