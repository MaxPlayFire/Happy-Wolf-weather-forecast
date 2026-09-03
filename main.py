import heapq
import sys

def solve():
    input = sys.stdin.read
    data = input().split()
    
    if not data:
        return

    N = int(data[0])
    M = int(data[1])

    graph = [[] for _ in range(N + 1)]
    
    idx = 2
    for _ in range(M):
        u = int(data[idx])
        v = int(data[idx+1])
        t = int(data[idx+2])
        idx += 3
        graph[u].append((v, t))
        graph[v].append((u, t))
    INF = float('inf')
    dist = [[INF] * (N + 1) for _ in range(2)]
    dist[0][1] = 0
    pq = [(0, 1, 0)]
    
    while pq:
        d, u, ticket_used = heapq.heappop(pq)
        if d > dist[ticket_used][u]:
            continue
        if u == N:
            print(d)
            return
        for v, t in graph[u]:
            if dist[ticket_used][v] > d + t:
                dist[ticket_used][v] = d + t
                heapq.heappush(pq, (d + t, v, ticket_used))
                
            if ticket_used == 0:
                if dist[1][v] > d:
                    dist[1][v] = d
                    heapq.heappush(pq, (d, v, 1))
                    
    print(-1)

if __name__ == '__main__':
    solve()
